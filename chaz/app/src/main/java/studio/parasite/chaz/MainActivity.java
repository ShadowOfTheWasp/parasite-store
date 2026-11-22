package studio.parasite.chaz;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
public final class MainActivity extends Activity {
 private WebView instrument;
 @Override public void onCreate(Bundle state){super.onCreate(state);instrument=new WebView(this);instrument.setBackgroundColor(0xff090e0d);instrument.getSettings().setJavaScriptEnabled(true);instrument.getSettings().setDomStorageEnabled(true);instrument.getSettings().setAllowFileAccess(false);instrument.getSettings().setAllowContentAccess(false);instrument.getSettings().setBlockNetworkLoads(true);instrument.getSettings().setMediaPlaybackRequiresUserGesture(true);instrument.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){if(request.isForMainFrame())finish();return true;}});setContentView(instrument);instrument.loadUrl("file:///android_asset/index.html");}
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused)getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);}
 @Override protected void onPause(){instrument.evaluateJavascript("if(typeof silence==='function')silence();",null);instrument.onPause();super.onPause();}
 @Override protected void onResume(){super.onResume();if(instrument!=null)instrument.onResume();}
 @Override protected void onDestroy(){setContentView(new View(this));if(instrument!=null)instrument.destroy();super.onDestroy();}
}
