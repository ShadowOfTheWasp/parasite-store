package studio.parasite.home;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.net.*;
import java.io.*;

public class HomeActivity extends Activity {
  private static final String HUB_URL = "https://parasite-kindle.vercel.app";
  private static final String RELEASE_API = "https://api.github.com/repos/ShadowOfTheWasp/parasite-store/releases/tags/parasite-home-v4";
  private static final int IMMERSIVE = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN |
    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
    View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
  private WebView web;
  private LinearLayout root;
  private int taps=0;
  private long lastTap=0;
  private boolean webError=false;
  private boolean displayedHub=false;
  private boolean hubLoaded=false;

  private void immersive() { getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE); }
  @Override public void onCreate(Bundle b) { super.onCreate(b); immersive(); home(); }
  @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if(focus)immersive(); }
  private TextView label(String s,int size,int color) {
    TextView t=new TextView(this); t.setText(s);t.setTextSize(size);t.setTextColor(color);
    t.setGravity(Gravity.CENTER); t.setPadding(10,14,10,14);return t;
  }
  private void begin() {
    if(web!=null){ web.stopLoading();web.destroy();web=null; }
    root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);root.setPadding(28,20,28,20);
    root.setBackgroundColor(Color.rgb(8,13,9));setContentView(root);immersive();
  }
  private void addButton(String title,Runnable click) {
    Button b=new Button(this); b.setAllCaps(false);b.setText(title); b.setTextSize(20);
    root.addView(b,new LinearLayout.LayoutParams(-1,-2)); b.setOnClickListener(v->click.run());
  }
  private void brand(){
    TextView t=label("parasite",56,Color.rgb(167,235,134));t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
    root.addView(t);root.addView(label("INSTRUMENT SYSTEM",12,Color.rgb(138,161,140)));
    t.setOnClickListener(v->{
      long now=System.currentTimeMillis();if(now-lastTap>1800)taps=0;lastTap=now;
      if(++taps>=5){taps=0;settings();}
    });
  }
  private void home() {
    displayedHub=false;begin();brand();
    addButton("HUB",this::hub);
    addButton("UPDATES",this::updates);
    root.addView(label("V5 • Tap logo five times for settings",11,Color.rgb(110,135,114)));
  }
  private String configuredUrl(){return getPreferences(0).getString("hub_url",HUB_URL);}
  private void hub() {
    displayedHub=true;hubLoaded=false;begin();
    addButton("‹ PARASITE HOME",this::home);
    FrameLayout holder=new FrameLayout(this);
    root.addView(holder,new LinearLayout.LayoutParams(-1,0,1));
    web=new WebView(this);web.setBackgroundColor(Color.rgb(8,13,9));web.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setMediaPlaybackRequiresUserGesture(false);
    web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
    web.setDownloadListener((url,userAgent,contentDisposition,mimeType,contentLength)->openDownload(url));
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        String target=request.getUrl().toString();
        if(isApkUrl(target)){openDownload(target);return true;}
        return false;
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,String target){
        if(isApkUrl(target)){openDownload(target);return true;}
        return false;
      }
      @Override public void onPageFinished(WebView view,String url){hubLoaded=true;}
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
        if(request.isForMainFrame() && !hubLoaded)
          runOnUiThread(()->hubUnavailable());
        else if(request.isForMainFrame())
          runOnUiThread(()->Toast.makeText(HomeActivity.this,"This page did not load. Go back to Hub and retry.",Toast.LENGTH_LONG).show());
      }
      @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){
        if(request.isForMainFrame() && response.getStatusCode()>=400){
          if(!hubLoaded)runOnUiThread(()->hubUnavailable());
          else runOnUiThread(()->Toast.makeText(HomeActivity.this,"Page unavailable (HTTP "+response.getStatusCode()+")",Toast.LENGTH_LONG).show());
        }
      }
    });
    holder.addView(web,new FrameLayout.LayoutParams(-1,-1));
    immersive();web.loadUrl(configuredUrl());
  }
  private boolean isApkUrl(String target){
    try{
      Uri uri=Uri.parse(target);
      String host=uri.getHost();
      String path=uri.getPath();
      if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||path==null)return false;
      boolean trusted=host.equals("github.com")||host.equals("raw.githubusercontent.com")||
        host.equals("shadowofthewasp.github.io")||host.equals("objects.githubusercontent.com");
      return trusted && path.toLowerCase(java.util.Locale.US).endsWith(".apk");
    }catch(Exception ex){return false;}
  }
  private void openDownload(String target){
    try{
      Uri uri=Uri.parse(target);
      if(!isApkUrl(target))throw new IllegalArgumentException("Unknown APK address");
      // Let Silk/Android handle the download and package installation consent.
      Intent intent=new Intent(Intent.ACTION_VIEW,uri);
      intent.addCategory(Intent.CATEGORY_BROWSABLE);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      intent.setPackage("com.amazon.cloud9");
      try{startActivity(intent);}
      catch(Exception noSilk){
        intent.setPackage(null);
        startActivity(intent);
      }
      Toast.makeText(this,"Download opened in browser. Approve installation there.",Toast.LENGTH_LONG).show();
    }catch(Exception e){
      new AlertDialog.Builder(this).setTitle("Open APK download")
        .setMessage("Could not open a download browser. Open the same instrument page in Silk.")
        .setPositiveButton("OK",null).show();
    }
  }
  private void hubUnavailable(){
    if(!displayedHub)return;
    displayedHub=false;begin();brand();
    root.addView(label("HUB UNAVAILABLE",21,Color.WHITE));
    root.addView(label("The online instrument Hub is not responding. No settings or apps have been changed.",14,Color.rgb(173,195,177)));
    addButton("BACK TO HOME",this::home);
    addButton("HUB ADDRESS / SETTINGS",this::settings);
  }
  private void updates(){
    displayedHub=false;begin();brand();
    TextView state=label("CHECKING LIVE INSTRUMENT CATALOGUE…",15,Color.WHITE);
    root.addView(state);
    addButton("OPEN HUB",this::hub);
    addButton("BACK TO HOME",this::home);
    new Thread(()->{
      String outcome;
      HttpURLConnection connection=null;
      try{
        URL address=new URL("https://raw.githubusercontent.com/ShadowOfTheWasp/parasite-store/main/docs/catalogue.json?t="+System.currentTimeMillis());
        connection=(HttpURLConnection)address.openConnection();
        connection.setConnectTimeout(9000);connection.setReadTimeout(9000);
        connection.setRequestProperty("User-Agent","ParasiteHome/4");
        connection.setUseCaches(false);
        if(connection.getResponseCode()!=200)throw new IOException("Catalogue HTTP "+connection.getResponseCode());
        java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
        try(java.io.InputStream in=connection.getInputStream()){
          byte[] block=new byte[4096];int n;
          while((n=in.read(block))!=-1){
            bytes.write(block,0,n);
            if(bytes.size()>65536)throw new IOException("Catalogue exceeds limit");
          }
        }
        org.json.JSONObject cat=new org.json.JSONObject(bytes.toString("UTF-8"));
        org.json.JSONArray units=cat.getJSONArray("units");
        StringBuilder lines=new StringBuilder();
        lines.append("CATALOGUE UP TO DATE\n\n");
        lines.append(units.length()).append(" AVAILABLE INSTRUMENTS\n\n");
        for(int i=0;i<units.length();i++){
          org.json.JSONObject u=units.getJSONObject(i);
          lines.append("• ").append(u.optString("title","Instrument"));
          String version=u.optString("version","");
          if(!version.isEmpty())lines.append("  /  ").append(version);
          lines.append("\n");
        }
        lines.append("\nCatalogue updated: ").append(cat.optString("updated","not specified"));
        lines.append("\n\nOpen HUB to load the latest web instruments.");
        outcome=lines.toString();
      }catch(Exception e){
        outcome="COULD NOT CHECK UPDATES\n\nCheck your Wi-Fi connection. Your installed instruments have not been changed.";
      }finally{if(connection!=null)connection.disconnect();}
      final String message=outcome;
      runOnUiThread(()->{if(state.getParent()!=null)state.setText(message);});
    }).start();
  }
  private void settings(){
    String[] opts={"Return to Parasite","Edit Hub address","Return to Amazon Home","Android Settings"};
    new AlertDialog.Builder(this).setTitle("Parasite / Settings").setItems(opts,(d,index)->{
      if(index==0)home();
      if(index==1)editUrl();
      if(index==2)amazon();
      if(index==3)startActivity(new Intent(Settings.ACTION_SETTINGS));
    }).setNegativeButton("Close",null).show();
  }
  private void editUrl(){
    EditText field=new EditText(this);field.setSingleLine(true);field.setText(configuredUrl());
    new AlertDialog.Builder(this).setTitle("Hub HTTPS address").setView(field).setPositiveButton("Save",(d,w)->{
      String s=field.getText().toString().trim();Uri u=Uri.parse(s);
      if("https".equals(u.getScheme()) && u.getHost()!=null){
        getPreferences(0).edit().putString("hub_url",s).apply();home();
      } else new AlertDialog.Builder(this).setMessage("Enter a valid HTTPS website address.").setPositiveButton("OK",null).show();
    }).setNegativeButton("Cancel",null).show();
  }
  private void amazon(){
    new AlertDialog.Builder(this).setTitle("Return to Amazon?")
      .setMessage("Leave Parasite and open the Amazon home screen?")
      .setPositiveButton("Return",(d,w)->{
        try{Intent i=new Intent(Intent.ACTION_MAIN);
          i.setClassName("com.amazon.firelauncher","com.amazon.firelauncher.Launcher");
          i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);startActivity(i);
        }catch(Exception e){startActivity(new Intent(Settings.ACTION_SETTINGS));}
      }).setNegativeButton("Cancel",null).show();
  }
  @Override public void onBackPressed(){home();}
}
