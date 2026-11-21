package studio.parasite.melt;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** MELT 2.1 / self-contained WebAudio instrument bundled inside the Android APK. */
public final class MainActivity extends Activity {
    private WebView instrument;
    private static final int IMMERSIVE=View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
       View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN |
       View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
       View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
    private void immersive(){getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE);}
    @Override public void onCreate(Bundle state){
       super.onCreate(state);
       immersive();
       instrument=new WebView(this);
       instrument.setBackgroundColor(Color.rgb(8,13,11));
       instrument.getSettings().setJavaScriptEnabled(true);
       instrument.getSettings().setDomStorageEnabled(true);
       instrument.getSettings().setMediaPlaybackRequiresUserGesture(false);
       instrument.getSettings().setAllowFileAccess(true);
       instrument.getSettings().setAllowContentAccess(false);
       instrument.setWebViewClient(new WebViewClient());
       instrument.setWebChromeClient(new WebChromeClient());
       setContentView(instrument);
       instrument.loadUrl("file:///android_asset/index.html");
    }
    @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused)immersive();}
    @Override public void onBackPressed(){finish();}
    @Override protected void onPause(){if(instrument!=null)instrument.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(instrument!=null)instrument.onResume();immersive();}
    @Override protected void onDestroy(){if(instrument!=null){instrument.loadUrl("about:blank");instrument.destroy();instrument=null;}super.onDestroy();}
}
