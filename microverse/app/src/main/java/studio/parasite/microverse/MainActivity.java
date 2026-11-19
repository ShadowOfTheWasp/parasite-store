package studio.parasite.microverse;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.content.Context;
import android.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.io.*;
import java.util.Random;

/**
 * PARASITE MICROVERSE V5 — Orbit-family full-screen cassette decks with an offline tape engine.
 * No cloud connection, adverts, permissions beyond microphone, or demo sounds.
 * Slot recordings and patterns are saved privately on the device.
 */
public class MainActivity extends Activity {
 static final int SR=22050, N=3, STEPS=32, MAX_SAMPLES=SR*5;
 static final int BG=0xff080e0a, INK=0xffdfe6d8, MUTED=0xff90b29b, ACID=0xffa1edaa,
   ORANGE=0xffd8c28d, PANEL=0xff142119;
 final Slot[] slots=new Slot[N];
 volatile boolean running=true, playing=false;
 volatile int step=0;
 int selected=0;
 AudioTrack player;
 Thread audioThread;
 LinearLayout slotColumn, controlColumn;
 CassetteView[] cassetteViews=new CassetteView[N];
 TextView[] deckLabels=new TextView[N];
 TextView[] directionButtons=new TextView[N];
 LinearLayout[] deckColumns=new LinearLayout[N];
 TextView status, playButton, slotName;
 final Random random=new Random();
 final float[] delayL=new float[SR*2],delayR=new float[SR*2];
 final float[] room=new float[SR/3];
 int tail=0, roomPos=0;
 float masterTone=.44f, masterWobble=.63f, masterDust=.38f, masterEcho=.35f, masterSpace=.48f;
 int bpm=76;
 long tick=0;

 static class Slot {
  volatile short[] sample=new short[0];
  boolean[] steps=new boolean[STEPS];
  volatile boolean reverse=false;
  float level=.78f, pitch=1f, attack=.005f, release=.22f, start=0f, end=1f, pan=0f;
  float hp=.0f, lp=.55f, echo=.35f, space=.4f;
  double pos=0, phase=0;
  int age=0;
  boolean active=false;
  float low=0, high=0, hpLast=0;
 }
 int dp(int v){return (int)(getResources().getDisplayMetrics().density*v+.5f);}
 TextView text(String s,int size,int color){
  TextView t=new TextView(this);t.setText(s);t.setTextColor(color);t.setTextSize(size);
  t.setTypeface(Typeface.MONOSPACE,Typeface.BOLD);return t;
 }
 TextView button(String s,Runnable action,int color){
  TextView b=text(s,13,BG);b.setBackgroundColor(color);b.setPadding(dp(13),dp(13),dp(13),dp(13));
  b.setGravity(Gravity.CENTER);b.setOnClickListener(v->action.run());return b;
 }
 LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(1);return l;}
 LinearLayout horizontal(){LinearLayout l=new LinearLayout(this);l.setOrientation(0);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
 @Override public void onCreate(Bundle b){
  super.onCreate(b);
  immersive();
  for(int i=0;i<N;i++){slots[i]=new Slot();restore(i);}
  bpm=getPreferences(0).getInt("bpm",76);
  show();
  startAudio();
 }
 private void immersive(){
  getWindow().getDecorView().setSystemUiVisibility(
   View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
   View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
   View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
 }
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused)immersive();}
 @Override protected void onResume(){super.onResume();immersive();}
 @Override protected void onDestroy(){
  running=false;
  if(player!=null){try{player.pause();player.flush();player.release();}catch(Exception ignored){}}
  super.onDestroy();
 }
 @Override public void onBackPressed(){playing=false;super.onBackPressed();}
 void show(){
  LinearLayout root=vertical();root.setBackgroundColor(BG);root.setPadding(dp(12),dp(6),dp(12),dp(5));
  LinearLayout header=horizontal();
  TextView brand=text("MICROVERSE_",26,ACID);header.addView(brand,new LinearLayout.LayoutParams(0,dp(43),1));
  header.addView(button("◀ PARASITE",()->finish(),MUTED));
  root.addView(header);
  root.addView(text("PARASITE_ / 002    •    THREE TAPE MACHINES    •    V5",10,ORANGE));
  LinearLayout transport=horizontal();
  playButton=button("▶ PLAY ALL",()->{
   playing=!playing;
   if(playing){for(Slot slot:slots){slot.pos=slot.sample.length*(slot.reverse?slot.end:slot.start);slot.age=0;slot.active=slot.sample.length>1;}}
   playButton.setText(playing?"■ STOP":"▶ PLAY ALL");updateStatus();
  },ACID);
  transport.addView(playButton,new LinearLayout.LayoutParams(0,dp(43),2));
  transport.addView(button("⟲ REWIND",()->{
    for(Slot slot:slots){slot.pos=slot.sample.length*(slot.reverse?slot.end:slot.start);slot.age=0;}
    updateStatus();
  },ORANGE),new LinearLayout.LayoutParams(0,dp(43),1));
  root.addView(transport);
  LinearLayout decks=horizontal();decks.setGravity(Gravity.TOP);
  for(int i=0;i<N;i++){
   final int index=i;
   LinearLayout shell=vertical();deckColumns[i]=shell;
   shell.setBackgroundColor(PANEL);shell.setPadding(dp(7),dp(6),dp(7),dp(5));
   LinearLayout.LayoutParams shellParams=new LinearLayout.LayoutParams(0,-1,1);
   shellParams.setMargins(dp(3),dp(3),dp(3),dp(3));decks.addView(shell,shellParams);
   TextView deckTitle=text("TAPE 0"+(i+1)+"  /  EMPTY",13,i==0?ACID:(i==1?ORANGE:INK));
   deckLabels[i]=deckTitle;shell.addView(deckTitle);
   cassetteViews[i]=new CassetteView(this,i);
   shell.addView(cassetteViews[i],new LinearLayout.LayoutParams(-1,0,1));
   LinearLayout actions=horizontal();
   actions.addView(button("● REC",()->record(index),ORANGE),new LinearLayout.LayoutParams(0,dp(40),1));
   actions.addView(button("IMPORT",()->{selected=index;importWav();},MUTED),new LinearLayout.LayoutParams(0,dp(40),1));
   actions.addView(button("×",()->new AlertDialog.Builder(this).setTitle("Erase tape 0"+(index+1)+"?")
       .setMessage("Remove this tape recording?").setNegativeButton("CANCEL",null)
       .setPositiveButton("ERASE",(d,w)->{slots[index].sample=new short[0];slots[index].active=false;persist(index);refreshSlots();}).show(),MUTED),
       new LinearLayout.LayoutParams(dp(37),dp(40)));
   shell.addView(actions);
   TextView direction=button(slots[index].reverse?"◀ REVERSE":"▶ FORWARD",()->{
     Slot tape=slots[index];
     tape.reverse=!tape.reverse;
     tape.pos=tape.sample.length*(tape.reverse?tape.end:tape.start);
     tape.age=0;
     persist(index);
     refreshSlots();
   },ACID);
   shell.addView(direction,new LinearLayout.LayoutParams(-1,dp(38)));
   directionButtons[index]=direction;
   addDeckSlider(shell,"SPEED",slots[index].pitch/2f,value->{slots[index].pitch=.35f+1.65f*value;persist(index);});
   addDeckSlider(shell,"TONE",slots[index].lp,value->{slots[index].lp=value;persist(index);});
   addDeckSlider(shell,"LEVEL",slots[index].level,value->{slots[index].level=value;persist(index);});
   addDeckSlider(shell,"ECHO",slots[index].echo,value->{slots[index].echo=value;persist(index);});
  }
  root.addView(decks,new LinearLayout.LayoutParams(-1,0,1));
  TextView masterTitle=text("MASTER / TAPE ENVIRONMENT",12,ACID);
  root.addView(masterTitle);
  LinearLayout masterRow=horizontal();
  addDeckSlider(masterRow,"DARK",1-masterTone,v->{masterTone=1-v;updateStatus();});
  addDeckSlider(masterRow,"WOBBLE",masterWobble,v->{masterWobble=v;updateStatus();});
  addDeckSlider(masterRow,"DIRT",masterDust,v->{masterDust=v;updateStatus();});
  addDeckSlider(masterRow,"SPACE",masterSpace,v->{masterSpace=v;updateStatus();});
  root.addView(masterRow,new LinearLayout.LayoutParams(-1,dp(59)));
  status=text("",10,MUTED);root.addView(status);updateStatus();
  setContentView(root);
  refreshSlots();
 }
 void addDeckSlider(LinearLayout target,String title,float value,Change cb){
  LinearLayout line=horizontal();TextView name=text(title,10,INK);
  line.addView(name,new LinearLayout.LayoutParams(dp(target.getOrientation()==LinearLayout.HORIZONTAL?49:65),dp(28)));
  SeekBar control=new SeekBar(this);control.setMax(100);
  control.setProgress(Math.round(Math.max(0,Math.min(1,value))*100));
  control.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
   public void onProgressChanged(SeekBar bar,int progress,boolean fromUser){if(fromUser)cb.set(progress/100f);}
   public void onStartTrackingTouch(SeekBar bar){}
   public void onStopTrackingTouch(SeekBar bar){}
  });
  line.addView(control,new LinearLayout.LayoutParams(0,dp(31),1));
  if(target.getOrientation()==LinearLayout.HORIZONTAL)target.addView(line,new LinearLayout.LayoutParams(0,dp(43),1));
  else target.addView(line,new LinearLayout.LayoutParams(-1,dp(32)));
 }
 interface Change {void set(float value);}
 void updateStatus(){
  if(status!=null)status.setText(playing?"● TAPE ROLLING  /  DRAG TO CHANGE THE SOUND":"■ STOPPED  /  RECORD UP TO FIVE SECONDS IN EACH CASSETTE");
 }
 void refreshSlots(){
  for(int i=0;i<N;i++){
   Slot s=slots[i];if(deckLabels[i]!=null)deckLabels[i].setText("TAPE 0"+(i+1)+"  /  "+
     (s.sample.length==0?"EMPTY":String.format(java.util.Locale.US,"%.1f SEC",s.sample.length/(float)SR)));
   if(directionButtons[i]!=null)directionButtons[i].setText(s.reverse?"◀ REVERSE":"▶ FORWARD");
   if(cassetteViews[i]!=null)cassetteViews[i].invalidate();
  }
 }
 void refreshControls(){refreshSlots();}
 final class CassetteView extends View{
  final int index;final Paint paint=new Paint(3);
  CassetteView(Context context,int i){super(context);index=i;setLayerType(View.LAYER_TYPE_SOFTWARE,null);}
  @Override protected void onDraw(Canvas canvas){
   super.onDraw(canvas);
   float w=getWidth(),h=getHeight(),cy=h*.52f;
   if(w<=1||h<=1)return;
   float left=w*.06f,top=h*.1f,right=w*.94f,bottom=h*.92f;
   paint.setColor(0xff0b1410);paint.setStyle(Paint.Style.FILL);
   canvas.drawRoundRect(left,top,right,bottom,dp(9),dp(9),paint);
   paint.setColor(0xff405546);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(dp(2));
   canvas.drawRoundRect(left,top,right,bottom,dp(9),dp(9),paint);
   paint.setStyle(Paint.Style.FILL);paint.setColor(0xff223428);
   canvas.drawRoundRect(w*.15f,h*.20f,w*.85f,h*.67f,dp(6),dp(6),paint);
   Slot s=slots[index];float prog=s.sample.length>0?(float)(s.pos/Math.max(1,s.sample.length)):0;
   float angle=playing?(float)(tick*.045*(.5f+s.pitch)*(s.reverse?-1:1)):0;
   float rad=Math.min(w*.115f,h*.19f),y=h*.43f;
   float[] xs={w*.33f,w*.67f};
   for(int n=0;n<2;n++){
    float cx=xs[n];paint.setColor(0xffbde3c2);canvas.drawCircle(cx,y,rad,paint);
    paint.setColor(0xff101c14);canvas.drawCircle(cx,y,rad*.78f,paint);
    paint.setColor(s.sample.length>0?ACID:0xff50785d);
    float wind=n==0?(1-prog):prog;canvas.drawCircle(cx,y,rad*(.40f+.27f*wind),paint);
    paint.setColor(0xff16251b);canvas.drawCircle(cx,y,rad*.25f,paint);
    paint.setColor(0xffbde3c2);paint.setStrokeWidth(dp(2));
    for(int j=0;j<3;j++){
     double a=angle+(j*2*Math.PI/3);float x=(float)Math.cos(a)*rad*.20f,yOff=(float)Math.sin(a)*rad*.20f;
     canvas.drawLine(cx-x*.6f,y-yOff*.6f,cx+x,y+yOff,paint);
    }
   }
   paint.setColor(index==0?ACID:index==1?ORANGE:0xff98b8aa);
   canvas.drawRoundRect(w*.22f,h*.73f,w*.78f,h*.86f,dp(3),dp(3),paint);
   paint.setColor(BG);paint.setTextSize(Math.max(dp(9),Math.min(dp(13),w*.055f)));
   paint.setTypeface(Typeface.create(Typeface.MONOSPACE,Typeface.BOLD));
   canvas.drawText(s.sample.length>0?"MAGNETIC TAPE":"BLANK CASSETTE",w*.25f,h*.825f,paint);
   if(running)postInvalidateDelayed(60);
  }
 }
 void record(int index){
  if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
   requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},20);
   Toast.makeText(this,"Allow microphone, then press REC again",Toast.LENGTH_LONG).show();return;
  }
  Toast.makeText(this,"Recording TAPE "+(index+1)+" for 5 seconds",Toast.LENGTH_LONG).show();
  new Thread(()->{
   int size=Math.max(4096,AudioRecord.getMinBufferSize(SR,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT));
   AudioRecord recorder=null;
   try{
    recorder=new AudioRecord(MediaRecorder.AudioSource.MIC,SR,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,size);
    if(recorder.getState()!=AudioRecord.STATE_INITIALIZED)throw new Exception("Microphone unavailable");
    short[] captured=new short[MAX_SAMPLES];recorder.startRecording();int offset=0;
    while(offset<captured.length){int n=recorder.read(captured,offset,Math.min(2048,captured.length-offset));if(n<=0)break;offset+=n;}
    recorder.stop();
    if(offset>0){short[] result=new short[offset];System.arraycopy(captured,0,result,0,offset);slots[index].sample=result;slots[index].pos=slots[index].reverse?result.length-1:0;slots[index].age=0;slots[index].active=playing;persist(index);}
    runOnUiThread(()->{refreshSlots();refreshControls();Toast.makeText(this,"TAPE CAPTURED",Toast.LENGTH_SHORT).show();});
   }catch(Exception e){runOnUiThread(()->Toast.makeText(this,"REC FAILED: "+e.getMessage(),Toast.LENGTH_LONG).show());}
   finally{if(recorder!=null)recorder.release();}
  },"microverse-rec").start();
 }
 void importWav(){
  Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("audio/*");i.addCategory(Intent.CATEGORY_OPENABLE);
  startActivityForResult(i,55);
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request!=55||result!=RESULT_OK||data==null)return;
  int index=selected;Uri uri=data.getData();
  new Thread(()->{
   try(InputStream in=getContentResolver().openInputStream(uri)){
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buf=new byte[4096];int n;
    while((n=in.read(buf))>0){bytes.write(buf,0,n);if(bytes.size()>2200000)break;}
    byte[] wav=bytes.toByteArray();
    if(wav.length<44||wav[0]!='R'||wav[1]!='I'||wav[2]!='F'||wav[3]!='F')throw new Exception("16-bit PCM WAV required");
    int channels=le16(wav,22),rate=le32(wav,24),bits=le16(wav,34);
    if((channels!=1&&channels!=2)||rate<8000||rate>96000||bits!=16||le16(wav,20)!=1)throw new Exception("Unsupported WAV encoding");
    int dataStart=12,dataSize=0;
    while(dataStart+8<=wav.length){
     int len=le32(wav,dataStart+4);
     if(wav[dataStart]=='d'&&wav[dataStart+1]=='a'&&wav[dataStart+2]=='t'&&wav[dataStart+3]=='a'){dataSize=Math.min(len,wav.length-dataStart-8);dataStart+=8;break;}
     if(len<0||dataStart+8L+len>wav.length)break;dataStart+=8+len+(len&1);
    }
    if(dataSize==0)throw new Exception("WAV audio data missing");
    int frames=dataSize/(channels*2),length=Math.min(MAX_SAMPLES,(int)((long)frames*SR/rate));
    short[] dst=new short[length];
    for(int j=0;j<length;j++){
     int src=(int)((long)j*rate/SR),off=dataStart+src*channels*2;
     if(off+channels*2> wav.length)break;
     int value=(short)le16(wav,off);
     if(channels==2)value=(value+(short)le16(wav,off+2))/2;
     dst[j]=(short)value;
    }
    slots[index].sample=dst;slots[index].pos=slots[index].reverse?Math.max(0,dst.length-1):0;slots[index].age=0;slots[index].active=playing;persist(index);
    runOnUiThread(()->{refreshSlots();refreshControls();Toast.makeText(this,"WAV IMPORTED",Toast.LENGTH_SHORT).show();});
   }catch(Exception ex){runOnUiThread(()->Toast.makeText(this,"IMPORT FAILED: "+ex.getMessage(),Toast.LENGTH_LONG).show());}
  },"microverse-wav").start();
 }
 static int le16(byte[] b,int p){return (b[p]&255)|((b[p+1]&255)<<8);}
 static int le32(byte[] b,int p){return (b[p]&255)|((b[p+1]&255)<<8)|((b[p+2]&255)<<16)|((b[p+3]&255)<<24);}
 void persist(int i){
  Slot s=slots[i];
  try{
   File target=new File(getFilesDir(),"tape"+i+".pcm");
   try(DataOutputStream o=new DataOutputStream(new BufferedOutputStream(new FileOutputStream(target)))){
    short[] samples=s.sample;for(short v:samples)o.writeShort(v);
   }
   StringBuilder bits=new StringBuilder();for(boolean v:s.steps)bits.append(v?'1':'0');
   getPreferences(0).edit().putString("steps"+i,bits.toString())
     .putFloat("level"+i,s.level).putFloat("pitch"+i,s.pitch).putFloat("attack"+i,s.attack)
     .putFloat("release"+i,s.release).putFloat("start"+i,s.start).putFloat("end"+i,s.end)
     .putFloat("pan"+i,s.pan).putFloat("hp"+i,s.hp).putFloat("lp"+i,s.lp)
     .putFloat("echo"+i,s.echo).putFloat("space"+i,s.space)
     .putBoolean("reverse"+i,s.reverse).apply();
  }catch(Exception ignored){}
 }
 void restore(int i){
  Slot s=slots[i];
  try{
   File target=new File(getFilesDir(),"tape"+i+".pcm");int size=(int)Math.min(MAX_SAMPLES,target.length()/2);
   short[] src=new short[size];try(DataInputStream in=new DataInputStream(new BufferedInputStream(new FileInputStream(target)))){
    for(int j=0;j<size;j++)src[j]=in.readShort();
   }s.sample=src;
  }catch(Exception ignored){}
  String bits=getPreferences(0).getString("steps"+i,"");
  for(int j=0;j<Math.min(STEPS,bits.length());j++)s.steps[j]=bits.charAt(j)=='1';
  s.level=getPreferences(0).getFloat("level"+i,s.level);s.pitch=getPreferences(0).getFloat("pitch"+i,s.pitch);
  s.attack=getPreferences(0).getFloat("attack"+i,s.attack);s.release=getPreferences(0).getFloat("release"+i,s.release);
  s.start=getPreferences(0).getFloat("start"+i,s.start);s.end=getPreferences(0).getFloat("end"+i,s.end);
  s.pan=getPreferences(0).getFloat("pan"+i,s.pan);s.hp=getPreferences(0).getFloat("hp"+i,s.hp);
  s.lp=getPreferences(0).getFloat("lp"+i,s.lp);s.echo=getPreferences(0).getFloat("echo"+i,s.echo);s.space=getPreferences(0).getFloat("space"+i,s.space);
  s.reverse=getPreferences(0).getBoolean("reverse"+i,false);
 }
 void startAudio(){
  int bufSize=Math.max(4096,AudioTrack.getMinBufferSize(SR,AudioFormat.CHANNEL_OUT_STEREO,AudioFormat.ENCODING_PCM_16BIT));
  player=new AudioTrack(AudioManager.STREAM_MUSIC,SR,AudioFormat.CHANNEL_OUT_STEREO,AudioFormat.ENCODING_PCM_16BIT,bufSize*2,AudioTrack.MODE_STREAM);
  player.play();
  audioThread=new Thread(()->{
   short[] output=new short[1024*2];int counter=0;
   while(running){
    int stepSamples=Math.max(1000,(int)(SR*60.0/(Math.max(35,bpm)*4)));
    for(int i=0;i<1024;i++){

     float L=0,R=0,echoL=0,echoR=0,sendRoom=0;
     if(playing){
      for(Slot s:slots){
       short[] pcm=s.sample;if(!s.active||pcm.length<2)continue;
       int end=Math.max(2,Math.min(pcm.length,(int)(pcm.length*s.end)));
       int start=Math.max(0,Math.min(end-2,(int)(pcm.length*s.start)));
       int p=(int)s.pos;
       if(s.pos<start || s.pos>=end-1){
        s.pos=s.reverse?end-2:start;s.age=0;p=(int)s.pos;
       }
       double wow=1+masterWobble*(.028*Math.sin(tick*.00054+s.phase)+.009*Math.sin(tick*.016+s.phase*3))+.003*masterWobble*(random.nextFloat()-.5f);
       float f=pcm[p]/32768f, next=pcm[p+1]/32768f;
       f+=(next-f)*(float)(s.pos-p);
       float cutoff=Math.max(.012f,Math.min(.9f,((1-masterTone)*.55f+.012f)*(.1f+s.lp*.9f)));
       s.low+=cutoff*(f-s.low);
       float high=s.low-s.hpLast;s.hpLast=s.low;
       s.high+=Math.max(.004f,s.hp*.45f)*(high-s.high);
       float tone=s.hp>0?Math.max(-1f,Math.min(1f,s.low-s.high*s.hp)):s.low;
       float dust=(random.nextFloat()-.5f)*masterDust*.012f;
       float crushed=(float)Math.tanh((tone+dust)*(1.3+masterDust*8));
       float held=(float)(Math.round(crushed*(160-masterDust*140))/(160-masterDust*140));
       float env=Math.min(1,s.age/(float)Math.max(1,(int)(s.attack*SR)));
       float remain=(float)Math.max(0,(s.reverse?s.pos-start:end-s.pos)/(SR*Math.max(.1,s.pitch)));
       env*=Math.min(1,remain/Math.max(.02,s.release));
       float v=held*env*s.level*.42f;
       float left=v*(1-s.pan)*.5f,right=v*(1+s.pan)*.5f;
       L+=left;R+=right;echoL+=left*s.echo;echoR+=right*s.echo;sendRoom+=v*s.space;
       s.pos+=(s.reverse?-1:1)*s.pitch*wow;s.age++;
      }
     }
     int d=tail%delayL.length;float dl=delayL[d],dr=delayR[d];
     delayL[d]=echoL+dr*masterEcho*.7f;delayR[d]=echoR+dl*masterEcho*.7f;
     int ri=roomPos%room.length;float rv=room[ri];
     room[ri]=sendRoom+rv*.77f;
     L+=dl*.4f+rv*masterSpace*.28f;R+=dr*.4f+rv*masterSpace*.33f;
     tail++;roomPos++;tick++;counter++;if(counter>=stepSamples)counter=0;
     if(!playing){L=0;R=0;}
     output[i*2]=(short)(32767*Math.max(-1,Math.min(1,L)));
     output[i*2+1]=(short)(32767*Math.max(-1,Math.min(1,R)));
    }
    try{player.write(output,0,output.length);}catch(Exception ignored){}
   }
  },"microverse-audio");audioThread.setPriority(Thread.MAX_PRIORITY);audioThread.start();
 }
}
