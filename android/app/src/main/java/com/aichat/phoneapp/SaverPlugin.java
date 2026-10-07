package com.aichat.phoneapp;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

// 把生成图/备份写入系统「下载/AIChat/」：
// 文件管理器可见可拷贝；图库不检索（下载目录 + .nomedia 标记）
@CapacitorPlugin(name = "Saver")
public class SaverPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String data = call.getString("data");
        String name = call.getString("name", "file");
        String mime = call.getString("mime", guessMime(name));
        if (data == null || data.length() == 0) {
            call.reject("empty data");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("需要安卓 10 以上");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AIChat");
            Uri uri = getContext().getContentResolver().insert(MediaStore.Images.EXTERNAL_CONTENT_URI, v);
            OutputStream os = getContext().getContentResolver().openOutputStream(uri);
            os.write(bytes);
            os.close();
            // 保证图库不检索该目录
            try {
                ContentValues n = new ContentValues();
                n.put(MediaStore.MediaColumns.DISPLAY_NAME, ".nomedia");
                n.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
                n.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AIChat");
                Uri nm = getContext().getContentResolver().insert(MediaStore.Images.EXTERNAL_CONTENT_URI, n);
                OutputStream nos = getContext().getContentResolver().openOutputStream(nm);
                nos.write(0);
                nos.close();
            } catch (Exception ignored) {
            }
            JSObject out = new JSObject();
            out.put("uri", uri.toString());
            call.resolve(out);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private String guessMime(String name) {
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".json")) return "application/json";
        return "image/png";
    }
}
