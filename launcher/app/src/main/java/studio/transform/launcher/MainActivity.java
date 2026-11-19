package studio.transform.launcher;

import android.app.Activity;
import android.app.AlertDialog;
import android.provider.Settings;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;

/** PARASITE V8 — reversible full-screen standalone instrument hub, no embedded synths. */
public final class MainActivity extends Activity {
 private static final String SITE="https://shadowofthewasp.github.io/parasite-store/";
 private static final String CATALOGUE=SITE+"catalogue.json";
 private static final String PREFS="parasite-settings";
 private static final int BG=0xff080d09, PANEL=0xff17221a, GREEN=0xffa6f5a7,
   WHITE=0xffe4eee0, MUTED=0xff8aab91;
 private static final class Unit {
  final String id,title,description,url;
  Unit(String a,String b,String c,String d){id=a;title=b;description=c;url=d;}
 }
 private final ArrayList<Unit> units=new ArrayList<>();
 private LinearLayout items;
 private TextView status;
 private Button bootButton;
 private int generation=0;
 private boolean autoBoot;
 private boolean zombieMode;

 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 private TextView label(String value,int size,int color,boolean bold){
  TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);
  t.setTypeface(Typeface.MONOSPACE,bold?Typeface.BOLD:Typeface.NORMAL);
  return t;
 }
 private Button button(String text,Runnable action,boolean primary){
  Button b=new Button(this);b.setAllCaps(false);b.setText(text);b.setTextSize(12);
  b.setTextColor(BG);b.setBackgroundTintList(ColorStateList.valueOf(primary?GREEN:0xffa6b9a8));
  b.setOnClickListener(v->action.run());return b;
 }
 private void open(String url){
  try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}
  catch(Exception e){Toast.makeText(this,"Browser unavailable",Toast.LENGTH_SHORT).show();}
 }
 private Intent launch(String id){
  try{return getPackageManager().getLaunchIntentForPackage(id);}
  catch(Exception e){return null;}
 }
 @Override public void onCreate(Bundle b){
  super.onCreate(b);
  autoBoot=getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean("launch-at-boot",false);
  zombieMode=getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean("zombie-mode",false);
  loadCached();
  show();
  refresh();
 }
 @Override protected void onResume(){
  super.onResume();
  getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
  if(items!=null)refresh();
 }
 private void show(){
  getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  root.setBackgroundColor(BG);root.setPadding(dp(22),dp(13),dp(22),dp(12));
  TextView brand=label("PARASITE_",31,GREEN,true);
  brand.setOnLongClickListener(v->{showSystemMenu();return true;});
  root.addView(brand);
  TextView sub=label("ZOMBIE MODE  /  FIRE EDITION  /  V8",12,MUTED,false);
  sub.setPadding(0,0,0,dp(14));root.addView(sub);

  LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);
  top.addView(button("CHECK UPDATES",this::refresh,true),new LinearLayout.LayoutParams(0,dp(53),1));
  top.addView(button("BROWSE LIBRARY",()->open(SITE),false),new LinearLayout.LayoutParams(0,dp(53),1));
  root.addView(top);
  TextView heading=label("YOUR INSTRUMENTS",17,WHITE,true);
  heading.setPadding(0,dp(21),0,dp(10));root.addView(heading);
  ScrollView scroller=new ScrollView(this);items=new LinearLayout(this);
  items.setOrientation(LinearLayout.VERTICAL);scroller.addView(items);
  root.addView(scroller,new LinearLayout.LayoutParams(-1,0,1));
  status=label("CHECKING ONLINE CATALOGUE...",11,MUTED,false);
  status.setPadding(0,dp(8),0,dp(9));root.addView(status);
  bootButton=button("",()->{
    autoBoot=!autoBoot;
    getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean("launch-at-boot",autoBoot).apply();
    updateBootButton();
    Toast.makeText(this,autoBoot?"Autostart enabled; test by restarting your Kindle":"Autostart disabled",Toast.LENGTH_LONG).show();
  },false);
  root.addView(bootButton,new LinearLayout.LayoutParams(-1,dp(47)));
  updateBootButton();
  root.addView(button("PARASITE SYSTEM  /  SETTINGS",this::showSystemMenu,false),new LinearLayout.LayoutParams(-1,dp(46)));
  TextView foot=label("FIRE OS INTACT  /  HOME REPLACEMENT DEPENDS ON DEVICE",10,MUTED,false);
  foot.setPadding(0,dp(7),0,0);root.addView(foot);
  setContentView(root);
  draw();
 }
 @Override public void onBackPressed(){
  if(zombieMode){Toast.makeText(this,"PARASITE Home: open System Settings to return to Fire OS",Toast.LENGTH_SHORT).show();}
  else super.onBackPressed();
 }
 private void showSystemMenu(){
  final String[] choices={"Enable PARASITE home mode","Disable PARASITE home mode","Choose default Home app (Fire OS settings)","Revert to Amazon OS (instructions)","Close"};
  new AlertDialog.Builder(this).setTitle("PARASITE SYSTEM  /  V8")
   .setItems(choices,(dialog,which)->{
    if(which==0){setZombie(true);openHomeSettings();}
    else if(which==1){setZombie(false);Toast.makeText(this,"PARASITE home mode disabled",Toast.LENGTH_LONG).show();}
    else if(which==2){openHomeSettings();}
    else if(which==3){
     setZombie(false);
     new AlertDialog.Builder(this).setTitle("REVERT TO AMAZON OS")
      .setMessage("Fire OS has not been removed. In the next screen, select the Amazon/Fire launcher as your default Home app if that option is available. You can also uninstall PARASITE from Fire OS Settings. Some Fire OS versions do not offer a Home-app chooser.")
      .setPositiveButton("OPEN HOME SETTINGS",(d,w)->openHomeSettings())
      .setNegativeButton("CANCEL",null).show();
    }
   }).setNegativeButton("DONE",null).show();
 }
 private void setZombie(boolean enabled){
  zombieMode=enabled;
  getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean("zombie-mode",enabled).apply();
 }
 private void openHomeSettings(){
  try{startActivity(new Intent(Settings.ACTION_HOME_SETTINGS));}
  catch(Exception e){
   Toast.makeText(this,"Home chooser unavailable on this Fire OS; use Fire OS Settings > Apps instead",Toast.LENGTH_LONG).show();
  }
 }
 private void loadCached(){
  try{
   String saved=getSharedPreferences(PREFS,MODE_PRIVATE).getString("catalogue-cache",null);
   if(saved==null)return;
   JSONObject obj=new JSONObject(saved);JSONArray list=obj.getJSONArray("units");
   if(list.length()>32)return;
   for(int i=0;i<list.length();i++){
    JSONObject entry=list.getJSONObject(i);
    String pkg=entry.getString("package"),title=entry.getString("title"),desc=entry.optString("description",""),url=entry.getString("installUrl");
    if(pkg.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+") && trustedUrl(url))units.add(new Unit(pkg,title,desc,url));
   }
  }catch(Exception ignored){}
 }
 private void updateBootButton(){
  if(bootButton!=null)bootButton.setText(autoBoot?"START AT BOOT  /  ON":"START AT BOOT  /  OFF");
 }
 private void draw(){
  if(items==null)return;
  items.removeAllViews();
  if(units.isEmpty()){
   LinearLayout empty=new LinearLayout(this);empty.setOrientation(LinearLayout.VERTICAL);
   empty.setBackgroundColor(PANEL);empty.setPadding(dp(25),dp(39),dp(20),dp(35));
   empty.addView(label("NO INSTRUMENTS INSTALLED",19,GREEN,true));
   TextView desc=label("PARASITE is ready.\n\nYour first instrument will appear here when it is released.",14,WHITE,false);
   desc.setPadding(0,dp(13),0,0);empty.addView(desc);
   items.addView(empty);
   return;
  }
  for(Unit u:units){
   Intent app=launch(u.id);boolean present=app!=null;
   LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);
   row.setGravity(Gravity.CENTER_VERTICAL);row.setBackgroundColor(PANEL);
   row.setPadding(dp(15),dp(12),dp(10),dp(12));
   LinearLayout meta=new LinearLayout(this);meta.setOrientation(LinearLayout.VERTICAL);
   meta.addView(label(u.title,17,WHITE,true));
   meta.addView(label(u.description+(present?" / INSTALLED":" / AVAILABLE"),11,MUTED,false));
   row.addView(meta,new LinearLayout.LayoutParams(0,dp(48),1));
   row.addView(button(present?"OPEN":"INSTALL",()->{
    Intent current=launch(u.id);
    if(current!=null)startActivity(current);else open(u.url);
   },present),new LinearLayout.LayoutParams(dp(116),dp(49)));
   LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(76));
   p.bottomMargin=dp(9);items.addView(row,p);
  }
 }
 private static boolean trustedUrl(String url){
  Uri uri=Uri.parse(url);
  return "https".equalsIgnoreCase(uri.getScheme())&&
     "shadowofthewasp.github.io".equalsIgnoreCase(uri.getHost())&&
     uri.getPath()!=null&&uri.getPath().startsWith("/parasite-store/");
 }
 private void refresh(){
  final int id=++generation;
  status.setText("CHECKING FOR NEW INSTRUMENTS...");
  new Thread(()->{
   try{
    HttpURLConnection c=(HttpURLConnection)new URL(CATALOGUE+"?t="+System.currentTimeMillis()).openConnection();
    c.setConnectTimeout(7000);c.setReadTimeout(7000);c.setUseCaches(false);
    c.setRequestProperty("Accept","application/json");
    if(c.getResponseCode()!=200)throw new Exception("HTTP "+c.getResponseCode());
    ByteArrayOutputStream out=new ByteArrayOutputStream();
    try(InputStream in=c.getInputStream()){
     byte[] buf=new byte[2048];int n;
     while((n=in.read(buf))!=-1){out.write(buf,0,n);if(out.size()>20000)throw new Exception("Invalid catalogue size");}
    }finally{c.disconnect();}
    JSONObject obj=new JSONObject(out.toString("UTF-8"));
    if(obj.getInt("schema")!=1)throw new Exception("Unknown catalogue version");
    JSONArray list=obj.getJSONArray("units");
    if(list.length()>32)throw new Exception("Invalid catalogue");
    ArrayList<Unit> next=new ArrayList<>();
    for(int i=0;i<list.length();i++){
     JSONObject entry=list.getJSONObject(i);
     String name=entry.getString("title"),pkg=entry.getString("package");
     String description=entry.optString("description",""),url=entry.getString("installUrl");
     if(name.length()>48||description.length()>110||
        !pkg.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+")||!trustedUrl(url))
       throw new Exception("Unsafe instrument entry");
     next.add(new Unit(pkg,name,description,url));
    }
    runOnUiThread(()->{
     if(isFinishing()||id!=generation)return;
     units.clear();units.addAll(next);
     getSharedPreferences(PREFS,MODE_PRIVATE).edit().putString("catalogue-cache",obj.toString()).apply();
     draw();
     status.setText(units.isEmpty()?"ONLINE / LIBRARY EMPTY  /  READY FOR FIRST RELEASE":
       "ONLINE / "+units.size()+" INSTRUMENT"+(units.size()==1?"":"S")+" AVAILABLE");
    });
   }catch(Exception e){
    runOnUiThread(()->{
     if(isFinishing()||id!=generation)return;
     status.setText(units.isEmpty()?"OFFLINE / FIRST ONLINE CHECK REQUIRED":"OFFLINE / CACHED INSTRUMENT LIBRARY");
     draw();
    });
   }
  },"parasite-hub-catalogue").start();
 }
}
