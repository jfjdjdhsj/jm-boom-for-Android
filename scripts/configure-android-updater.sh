#!/usr/bin/env bash
set -euo pipefail

# 让 Android 端可以应用内下载并安装 APK（无需跳转浏览器）：
# 1. 声明 REQUEST_INSTALL_PACKAGES 权限
# 2. 注入 UpdateInstaller 插件（Tauri mobile plugin）

manifest="src-tauri/gen/android/app/src/main/AndroidManifest.xml"
if [ ! -f "$manifest" ]; then
  echo "Android manifest not found: $manifest" >&2
  exit 1
fi

if ! grep -q 'android.permission.REQUEST_INSTALL_PACKAGES' "$manifest"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />' "$manifest"
fi

package_id="$(jq -r '.identifier' src-tauri/tauri.conf.json)"
package_path="${package_id//./\/}"
plugin_dir="src-tauri/gen/android/app/src/main/java/$package_path"
plugin_file="$plugin_dir/UpdateInstaller.kt"
mkdir -p "$plugin_dir"

cat > "$plugin_file" <<'KOTLIN'
package __PACKAGE__

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileInputStream

class UpdateInstaller(private val appActivity: Activity) : Plugin(appActivity) {
    companion object {
        private const val INSTALL_RESULT_ACTION = "__PACKAGE__.UPDATE_INSTALL_RESULT"
        private const val SESSION_NAME = "jm-boom-update"
    }

    @Command
    fun getUpdateDir(invoke: Invoke) {
        val dir = File(appActivity.filesDir, "updates")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        val result = JSObject()
        result.put("dir", dir.absolutePath)
        invoke.resolve(result)
    }

    @Command
    fun cleanUpdateDir(invoke: Invoke) {
        val dir = File(appActivity.filesDir, "updates")
        deleteUpdateFiles(dir)
        val result = JSObject()
        result.put("ok", true)
        invoke.resolve(result)
    }

    @Command
    fun installApk(invoke: Invoke) {
        val path = invoke.getArgs().optString("path", "")
        if (path.isBlank()) {
            invoke.reject("missing apk path")
            return
        }

        val apk = File(path)
        if (!apk.exists()) {
            invoke.reject("apk not found: $path")
            return
        }

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !appActivity.packageManager.canRequestPackageInstalls()
        ) {
            val settingsIntent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${appActivity.packageName}")
            )
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { appActivity.startActivity(settingsIntent) }
            invoke.reject("需要先授予「安装未知应用」权限")
            return
        }

        try {
            installWithPackageInstaller(apk)
            val result = JSObject()
            result.put("ok", true)
            invoke.resolve(result)
        } catch (error: Exception) {
            invoke.reject(error.message ?: error.toString())
        }
    }

    private fun installWithPackageInstaller(apk: File) {
        val installer = appActivity.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)

        try {
            val output = session.openWrite(SESSION_NAME, 0, apk.length())
            FileInputStream(apk).use { input -> input.copyTo(output) }
            session.fsync(output)
            output.close()

            val resultIntent = Intent(INSTALL_RESULT_ACTION).setPackage(appActivity.packageName)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(appActivity, sessionId, resultIntent, flags)

            registerInstallResultReceiver(apk)
            session.commit(pendingIntent.intentSender)
        } catch (error: Exception) {
            runCatching { installer.abandonSession(sessionId) }
            throw error
        } finally {
            runCatching { session.close() }
        }
    }

    private fun registerInstallResultReceiver(apk: File) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent?) {
                runCatching { context.unregisterReceiver(this) }
                // 安装结束（成功或失败）后清掉私有目录里的安装包。
                runCatching { deleteUpdateFiles(File(appActivity.filesDir, "updates")) }
            }
        }

        val filter = IntentFilter(INSTALL_RESULT_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appActivity.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            appActivity.registerReceiver(receiver, filter)
        }
    }

    private fun deleteUpdateFiles(target: File) {
        if (!target.exists()) {
            return
        }
        target.listFiles()?.forEach { child ->
            if (child.isDirectory) {
                deleteUpdateFiles(child)
            }
            runCatching { child.delete() }
        }
    }
}
KOTLIN

sed -i "s/__PACKAGE__/$package_id/g" "$plugin_file"

# release 构建开启了 R8，插件是通过类名/方法名反射调用的，必须保留。
# Tauri 自带的规则只保护带 @TauriPlugin 注解的类，这里是手动注册的插件。
proguard_file="src-tauri/gen/android/app/updater-rules.pro"
cat > "$proguard_file" <<'PROGUARD'
-keepattributes RuntimeVisibleAnnotations
-keep class app.tauri.annotation.** { *; }
-keep class __PACKAGE__.UpdateInstaller {
    public <init>(android.app.Activity);
    @app.tauri.annotation.Command public <methods>;
}
PROGUARD
sed -i "s/__PACKAGE__/$package_id/g" "$proguard_file"

echo "Configured Android in-app updater for $package_id"
