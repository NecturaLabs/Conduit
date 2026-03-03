package com.conduit.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Draw edge-to-edge so we control all inset handling ourselves
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }

    @Override
    public void onStart() {
        super.onStart();

        // Inject status bar + navigation bar heights as CSS variables
        // so the web layer can pad itself correctly without env() support.
        View rootView = getWindow().getDecorView().getRootView();
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
            int statusBarHeight = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int navBarHeight    = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            int leftInset       = insets.getInsets(WindowInsetsCompat.Type.systemBars()).left;
            int rightInset      = insets.getInsets(WindowInsetsCompat.Type.systemBars()).right;

            float density = getResources().getDisplayMetrics().density;
            float statusPx = statusBarHeight / density;
            float navPx    = navBarHeight    / density;
            float leftPx   = leftInset       / density;
            float rightPx  = rightInset      / density;

            String js = String.format(
                "document.documentElement.style.setProperty('--sat', '%spx');" +
                "document.documentElement.style.setProperty('--sab', '%spx');" +
                "document.documentElement.style.setProperty('--sal', '%spx');" +
                "document.documentElement.style.setProperty('--sar', '%spx');",
                statusPx, navPx, leftPx, rightPx
            );

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(js, null));
            }

            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }
}
