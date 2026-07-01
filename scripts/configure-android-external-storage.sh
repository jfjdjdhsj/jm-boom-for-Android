#!/usr/bin/env bash
set -euo pipefail

manifest="src-tauri/gen/android/app/src/main/AndroidManifest.xml"
if [ ! -f "$manifest" ]; then
  echo "Android manifest not found: $manifest" >&2
  exit 1
fi

if ! grep -q 'android.permission.MANAGE_EXTERNAL_STORAGE' "$manifest"; then
  sed -i '/<manifest/a\    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />' "$manifest"
fi

if ! grep -q 'android:requestLegacyExternalStorage="true"' "$manifest"; then
  sed -i '0,/<application/{s/<application/<application android:requestLegacyExternalStorage="true"/}' "$manifest"
fi

package_id="$(jq -r '.identifier' src-tauri/tauri.conf.json)"
package_path="${package_id//./\/}"
activity_dir="src-tauri/gen/android/app/src/main/java/$package_path"
activity_file="$activity_dir/MainActivity.kt"
mkdir -p "$activity_dir"

cat > "$activity_file" <<KOTLIN
package $package_id

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.WebView
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import java.io.File

class MainActivity : TauriActivity() {
    private var storageSettingsOpened = false
    private var appWebView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        onBackPressedDispatcher.addCallback(this) {
            handleSystemBack()
        }
        requestExternalStorageAccess()
        ensureExternalDirectories()
    }

    override fun onWebViewCreate(webView: WebView) {
        appWebView = webView
    }

    override fun onResume() {
        super.onResume()
        ensureExternalDirectories()
    }

    private fun requestExternalStorageAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager() || storageSettingsOpened) {
                return
            }

            storageSettingsOpened = true
            val appSettings = Intent(
                Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:\$packageName")
            )
            val fallbackSettings = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)

            runCatching { startActivity(appSettings) }
                .getOrElse { startActivity(fallbackSettings) }
            return
        }

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission("android.permission.WRITE_EXTERNAL_STORAGE") !=
                PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(
                    "android.permission.READ_EXTERNAL_STORAGE",
                    "android.permission.WRITE_EXTERNAL_STORAGE"
                ),
                1001
            )
        }
    }

    private fun ensureExternalDirectories() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
            return
        }

        File("/storage/emulated/0/jj-boom/downloads").mkdirs()
        File("/storage/emulated/0/jj-boom/logs").mkdirs()
    }

    private fun handleSystemBack() {
        val currentPath = appWebView?.url?.let { Uri.parse(it).path }.orEmpty()
        if (currentPath.isBlank() || currentPath == "/") {
            moveTaskToBack(true)
            return
        }

        appWebView?.evaluateJavascript("history.back()", null) ?: moveTaskToBack(true)
    }
}
KOTLIN
