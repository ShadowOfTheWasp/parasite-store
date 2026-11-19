package studio.transform.launcher;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

/**
 * PARASITE V2 — reversible instrument hub. The catalogue is fetched from the
 * PARASITE website each time the launcher is opened, without APK replacement.
 * Amazon Fire OS remains installed and retains user control.
 */
public final class MainActivity extends Activity {
 private static final int BG=0xff080b09, PANEL=0xff141e18, TEXT=0xffd7f5d5,
                          GREEN=0xff8cfa8a, MUTED=0xff8baf90;
 private static final String STORE="https://shadowofthewasp.github.io/parasite-store";
 private static final String CATALOGUE=STORE+"/catalogue.json";
 private static final class Unit {
  final String id,title,description,url;
  Unit(String id,String title,String description,String url){
   this.id=id;this.title=title;this.description=description;this.url=url;
  }
 }
 private final ArrayList<Unit> units=new ArrayList<>();
 private LinearLayout cards;
 private TextView status;
 private int generation=0;

 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 private TextView text(String value,int size,int color,boolean bold){
  TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);
  t.setTypeface(Typeface.MONOSPACE,bold?Typeface.BOLD:Typeface.NORMAL);
  return t;
 }
 private Button button(String value,Runnable action,boolean primary){
  Button b=new Button(this);b.setText(value);b.setTextSize(12);b.setAllCaps(false);
  b.setTextColor(BG);
  b.setBackgroundTintList(ColorStateList.valueOf(primary?GREEN:0xffa0b8a1));
  b.setOnClickListener(v->action.run());return b;
 }
 private void open(String url){
  try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}
  catch(Exception e){Toast.makeText(this,"Browser unavailable",Toast.LENGTH_SHORT).show();}
 }
 private Intent launchIntent(String pkg){
  try{return getPackageManager().getLaunchIntentForPackage(pkg);}
  catch(Exception e){return null;}
 }
 @Override public void onCreate(Bundle b){
  super.onCreate(b);show();updateCatalogue();
 }
 @Override protected void onResume(){super.onResume();if(cards!=null)updateCatalogue();}
 private void show(){
  getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  root.setBackgroundColor(BG);root.setPadding(dp(23),dp(14),dp(23),dp(12));
  root.addView(text("PARASITE_",31,GREEN,true));
  TextView sub=text("ONE TABLET / ENDLESS INSTRUMENTS",11,MUTED,false);
  sub.setPadding(0,0,0,dp(15));root.addView(sub);
  LinearLayout toolbar=new LinearLayout(this);
  toolbar.addView(button("GET NEW INSTRUMENTS",()->open(STORE),true),
    new LinearLayout.LayoutParams(0,dp(51),2));
  toolbar.addView(button("CHECK UPDATES",this::updateCatalogue,false),
    new LinearLayout.LayoutParams(0,dp(51),1));
  root.addView(toolbar);
  TextView heading=text("AVAILABLE UNITS / INSTALLED UNITS OPEN DIRECTLY",13,TEXT,true);
  heading.setPadding(0,dp(20),0,dp(7));root.addView(heading);
  ScrollView scroll=new ScrollView(this);
  cards=new LinearLayout(this);cards.setOrientation(LinearLayout.VERTICAL);
  scroll.addView(cards);
  root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  status=text("PARASITE V4 / CHECKING LIBRARY...",11,MUTED,false);
  status.setPadding(0,dp(5),0,dp(6));root.addView(status);
  root.addView(text("FIRE OS REMAINS INSTALLED / NO FIRMWARE MODIFICATION",10,MUTED,false));
  setContentView(root);
  drawCards();
 }
 private void drawCards(){
  if(cards==null)return;
  cards.removeAllViews();
  if(units.isEmpty()){
   TextView empty=text("NO INSTRUMENTS RELEASED / FLAGSHIP IN DEVELOPMENT",15,GREEN,true);
   empty.setPadding(dp(15),dp(28),dp(12),dp(22));cards.addView(empty);
  }
  for(Unit item:units){
   Intent app=launchIntent(item.id);
   boolean installed=app!=null;
   LinearLayout entry=new LinearLayout(this);
   entry.setOrientation(LinearLayout.HORIZONTAL);entry.setGravity(Gravity.CENTER_VERTICAL);
   entry.setBackgroundColor(PANEL);entry.setPadding(dp(13),dp(9),dp(10),dp(9));
   LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);
   info.addView(text(item.title,17,TEXT,true));
   info.addView(text(item.description+(installed?" / INSTALLED":" / AVAILABLE"),10,MUTED,false));
   entry.addView(info,new LinearLayout.LayoutParams(0,dp(51),1));
   entry.addView(button(installed?"OPEN":"INSTALL",()->{
    Intent current=launchIntent(item.id);
    if(current!=null)startActivity(current);else open(item.url);
   },installed),new LinearLayout.LayoutParams(dp(107),dp(51)));
   LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(72));
   lp.bottomMargin=dp(8);cards.addView(entry,lp);
  }
 }
 private static boolean approvedUrl(String address){
  Uri u=Uri.parse(address);
  String h=u.getHost();
  return "https".equalsIgnoreCase(u.getScheme()) && h!=null
      && ("shadowofthewasp.github.io".equalsIgnoreCase(h)
         );
 }
 private void updateCatalogue(){
  final int current=++generation;
  if(status!=null)status.setText("CHECKING PARASITE CATALOGUE...");
  new Thread(()->{
   try{
    HttpURLConnection conn=(HttpURLConnection)new URL(CATALOGUE+"?v="+System.currentTimeMillis()).openConnection();
    conn.setConnectTimeout(7000);conn.setReadTimeout(7000);conn.setRequestProperty("Accept","application/json");
    conn.setUseCaches(false);
    if(conn.getResponseCode()!=200)throw new Exception("Server unavailable");
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
    try(InputStream in=conn.getInputStream()){
     byte[] buf=new byte[2048];int read;
     while((read=in.read(buf))!=-1){bytes.write(buf,0,read);if(bytes.size()>16384)throw new Exception("Catalogue too large");}
    }finally{conn.disconnect();}
    JSONObject root=new JSONObject(bytes.toString("UTF-8"));
    if(root.getInt("schema")!=1)throw new Exception("Unsupported catalogue schema");
    JSONArray records=root.getJSONArray("units");
    if(records.length()>32)throw new Exception("Invalid catalogue");
    ArrayList<Unit> next=new ArrayList<>();
    for(int i=0;i<records.length();i++){
     JSONObject item=records.getJSONObject(i);
     String id=item.getString("package"),url=item.getString("installUrl");
     if(!id.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+")
         || !approvedUrl(url))throw new Exception("Unsafe catalogue entry");
     String title=item.getString("title");
     String desc=item.optString("description","");
     if(title.length()>48||desc.length()>110)throw new Exception("Invalid entry length");
     next.add(new Unit(id,title,desc,url));
    }
    runOnUiThread(()->{
     if(isFinishing()||current!=generation)return;
     units.clear();units.addAll(next);drawCards();
     status.setText(units.isEmpty()?"CATALOGUE ONLINE / FLAGSHIP IN DEVELOPMENT":"CATALOGUE ONLINE / "+units.size()+" UNIT"+(units.size()==1?"":"S")+" AVAILABLE");
    });
   }catch(Exception e){
    runOnUiThread(()->{
     if(isFinishing()||current!=generation)return;
     status.setText("OFFLINE CATALOGUE / CHECK CONNECTION TO SEE NEW UNITS");
     drawCards();
    });
   }
  },"parasite-catalogue").start();
 }
}
