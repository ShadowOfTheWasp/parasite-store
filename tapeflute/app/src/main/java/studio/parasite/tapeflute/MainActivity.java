package studio.parasite.tapeflute;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final String HUB = "https://shadowofthewasp.github.io/parasite-store/";
    private WebView instrument;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        instrument = new WebView(this);
        instrument.setBackgroundColor(0xff080e0a);
        WebSettings settings = instrument.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        instrument.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && HUB.equals(request.getUrl().toString())) finish();
                return true;
            }
        });
        setContentView(instrument);
        instrument.loadUrl("file:///android_asset/index.html#kindle");
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    protected void onPause() {
        instrument.evaluateJavascript(
            "if (typeof releaseAll === 'function') releaseAll();"
            + "if (typeof context !== 'undefined' && context) context.suspend();", null);
        instrument.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        instrument.onResume();
    }

    @Override
    protected void onDestroy() {
        setContentView(new View(this));
        instrument.destroy();
        super.onDestroy();
    }
}
