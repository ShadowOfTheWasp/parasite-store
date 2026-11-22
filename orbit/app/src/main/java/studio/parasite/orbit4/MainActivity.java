package studio.parasite.orbit4;

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
    private android.webkit.ValueCallback<android.net.Uri[]> pendingPicker;
    private static final int PICK_AUDIO=610;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        instrument = new WebView(this);
        instrument.setBackgroundColor(0xff080e0a);
        WebSettings settings = instrument.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setDomStorageEnabled(true);
        settings.setBlockNetworkLoads(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        instrument.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && HUB.equals(request.getUrl().toString())) finish();
                return true;
            }
        });
        instrument.setWebChromeClient(new android.webkit.WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,android.webkit.ValueCallback<android.net.Uri[]> callback,FileChooserParams params){
                if(pendingPicker!=null)pendingPicker.onReceiveValue(null);
                pendingPicker=callback;
                android.content.Intent picker=new android.content.Intent(android.content.Intent.ACTION_GET_CONTENT);
                picker.setType("audio/*");picker.addCategory(android.content.Intent.CATEGORY_OPENABLE);
                picker.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{startActivityForResult(picker,PICK_AUDIO);}catch(Exception e){pendingPicker=null;callback.onReceiveValue(null);}
                return true;
            }
        });
        setContentView(instrument);
        instrument.loadUrl("file:///android_asset/index.html#kindle");
    }

    @Override protected void onActivityResult(int code,int result,android.content.Intent data){
        super.onActivityResult(code,result,data);
        if(code==PICK_AUDIO&&pendingPicker!=null){android.webkit.ValueCallback<android.net.Uri[]> callback=pendingPicker;pendingPicker=null;callback.onReceiveValue(android.webkit.WebChromeClient.FileChooserParams.parseResult(result,data));}
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
            "if (typeof panic === 'function') panic();"
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
        if(pendingPicker!=null){pendingPicker.onReceiveValue(null);pendingPicker=null;}
        setContentView(new View(this));
        instrument.destroy();
        super.onDestroy();
    }
}
