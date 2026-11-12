package com.aichat.phoneapp;

import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 生成期间防止 WebView 被安卓暂停：
// 切到其他应用时 Capacitor 会调 webView.onPause()/pauseTimers()，JS 停止运行，
// SSE 流没人消费就会被服务商/中转站掐断，回前台只能重新生成。
// 前台服务（ForegroundService）只能保进程，管不了 WebView 的暂停；
// 这里在前台服务存续期间周期性 resume，让流式回复在后台继续跑。
@CapacitorPlugin(name = "WebViewKeeper")
public class WebViewKeeperPlugin extends Plugin {

    private Handler handler;
    private Runnable resumeTask;

    @PluginMethod
    public void startKeepResuming(PluginCall call) {
        stopInternal();
        handler = new Handler(Looper.getMainLooper());
        resumeTask = new Runnable() {
            @Override
            public void run() {
                try {
                    // 唤醒 WebView（抵消 Activity 暂停时的 onPause/pauseTimers）
                    getBridge().getWebView().onResume();
                    getBridge().getWebView().resumeTimers();
                } catch (Exception ignored) {
                }
                handler.postDelayed(this, 2000);
            }
        };
        // 延迟 800ms：等 Activity onPause 的暂停动作先完成再唤醒，避免互相覆盖
        handler.postDelayed(resumeTask, 800);
        call.resolve();
    }

    @PluginMethod
    public void stopKeepResuming(PluginCall call) {
        stopInternal();
        if (call != null) call.resolve();
    }

    private void stopInternal() {
        if (handler != null && resumeTask != null) {
            handler.removeCallbacks(resumeTask);
        }
        handler = null;
        resumeTask = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopInternal();
        super.handleOnDestroy();
    }
}
