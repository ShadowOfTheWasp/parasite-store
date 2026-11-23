package com.typelab.fire7;

import android.app.Activity;
import android.print.PrintManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;

public class MainActivity extends Activity {
    private static final int PICK_FILE = 61;
    private static final int SAVE_FILE = 62;
    private WebView web;
    private ValueCallback<Uri[]> pendingChooser;
    private byte[] pendingSave;
    private String pendingMime;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16,27,25));
        getWindow().setNavigationBarColor(Color.rgb(16,27,25));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(13,22,21));
        setContentView(web);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDefaultTextEncodingName("UTF-8");
        web.addJavascriptInterface(new Bridge(),"TypeLabAndroid");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if("https".equals(uri.getScheme()) && "typelab.local".equals(uri.getHost()) && "/index.html".equals(uri.getPath())){
                    try {
                        InputStream in=getAssets().open("index.html");
                        return new WebResourceResponse("text/html","UTF-8",in);
                    } catch(IOException e) {
                        return new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream("Unable to load TYPELAB".getBytes()));
                    }
                }
                if ("https".equals(uri.getScheme()) && ("fonts.googleapis.com".equals(uri.getHost()) || "fonts.gstatic.com".equals(uri.getHost()))) return null;
                return new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params){
                if(pendingChooser!=null) pendingChooser.onReceiveValue(null);
                pendingChooser=callback;
                try{
                    Intent pick=params.createIntent();
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(pick,PICK_FILE);
                }catch(Exception e){
                    pendingChooser.onReceiveValue(null);
                    pendingChooser=null;
                }
                return true;
            }
        });
        web.loadUrl("https://typelab.local/index.html");
    }

    private final class Bridge {
        @JavascriptInterface public void save(final String requestedName, final String mime, final String base64) {
            runOnUiThread(new Runnable(){@Override public void run(){
                try{
                    pendingSave=Base64.decode(base64,Base64.DEFAULT);
                    pendingMime=mime==null||mime.isEmpty()?"application/octet-stream":mime;
                    String name=requestedName==null?"TYPELAB-export":requestedName.replaceAll("[^a-zA-Z0-9._-]","_");
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(pendingMime);
                    intent.putExtra(Intent.EXTRA_TITLE,name);
                    startActivityForResult(intent,SAVE_FILE);
                }catch(Exception e){pendingSave=null;}
            }});
        }
        @JavascriptInterface public void print(){
            runOnUiThread(new Runnable(){@Override public void run(){
                try{
                    PrintManager pm=(PrintManager)getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter=web.createPrintDocumentAdapter("TYPELAB-Study");
                    pm.print("TYPELAB-Study",adapter,new PrintAttributes.Builder().build());
                }catch(Exception ignored){}
            }});
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_FILE){
            if(pendingChooser!=null){
                Uri[] selected=null;
                if(result==RESULT_OK && data!=null){
                    if(data.getData()!=null) selected=new Uri[]{data.getData()};
                    else if(data.getClipData()!=null){
                        int count=data.getClipData().getItemCount();
                        selected=new Uri[count];
                        for(int i=0;i<count;i++) selected[i]=data.getClipData().getItemAt(i).getUri();
                    }
                }
                pendingChooser.onReceiveValue(selected);
                pendingChooser=null;
            }
        }else if(request==SAVE_FILE){
            if(result==RESULT_OK && data!=null && data.getData()!=null && pendingSave!=null){
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
                    if(out!=null) out.write(pendingSave);
                }catch(IOException ignored){}
            }
            pendingSave=null;
        }
    }
    @Override public void onBackPressed(){
        if(web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(pendingChooser!=null){pendingChooser.onReceiveValue(null);pendingChooser=null;}
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}
