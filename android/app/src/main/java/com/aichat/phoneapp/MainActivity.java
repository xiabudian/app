package com.aichat.phoneapp;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 安卓 15 强制全面屏兜底：让窗口不再延伸到状态栏/手势条下面
        // （与 themes.xml 中的 windowOptOutEdgeToEdgeEnforcement 双保险）
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        registerPlugin(SaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
