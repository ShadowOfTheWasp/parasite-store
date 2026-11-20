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
  private static final String RELEASE_API = "https://api.github.com/repos/ShadowOfTheWasp/parasite-store/releases/tags/parasite-home-v3";
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
    root.addView(label("V3 • Tap logo five times for settings",11,Color.rgb(110,135,114)));
  }
  private String configuredUrl(){return getPreferences(0).getString("hub_url",HUB_URL);}
  private void hub() {
    displayedHub=true;begin();
    addButton("‹ PARASITE HOME",this::home);
    FrameLayout holder=new FrameLayout(this);
    root.addView(holder,new LinearLayout.LayoutParams(-1,0,1));
    web=new WebView(this);web.setBackgroundColor(Color.rgb(8,13,9));
    web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setMediaPlaybackRequiresUserGesture(false);
    web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
    web.setWebViewClient(new WebViewClient(){
      @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError error){
        if(r.isForMainFrame())runOnUiThread(()->hubUnavailable()); }
      @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse response){
        if(r.isForMainFrame() && response.getStatusCode()>=400)runOnUiThread(()->hubUnavailable()); }
    });
    holder.addView(web,new FrameLayout.LayoutParams(-1,-1));
    immersive();web.loadUrl(configuredUrl());
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
    TextView state=label("CHECKING GITHUB RELEASES…",15,Color.WHITE);root.addView(state);
    addButton("BACK TO HOME",this::home);
    new Thread(()->{
      String outcome;
      HttpURLConnection connection=null;
      try{
        URL address=new URL(RELEASE_API);
        connection=(HttpURLConnection)address.openConnection();
        connection.setConnectTimeout(8000);connection.setReadTimeout(8000);
        connection.setRequestProperty("Accept","application/vnd.github+json");
        connection.setRequestProperty("User-Agent","ParasiteHome/3");
        int code=connection.getResponseCode();
        if(code==200)outcome="PARASITE HOME V3 AVAILABLE\n\nThis device is running V3.\n\nThe instrument catalogue is not connected to this updater yet.";
        else if(code==404)outcome="No V3 release currently published.\nYour installed Home screen is unchanged.";
        else outcome="Update server responded with HTTP "+code+".\nPlease try again.";
      } catch(Exception e){outcome="Cannot reach the update server.\nCheck Wi-Fi and try again.";}
      finally{if(connection!=null)connection.disconnect();}
      final String message=outcome;
      runOnUiThread(()->state.setText(message));
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
