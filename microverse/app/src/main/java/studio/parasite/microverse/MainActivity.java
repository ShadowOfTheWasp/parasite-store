package studio.parasite.microverse;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
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
 * PARASITE MICROVERSE V3 — standalone 8-voice tape organism.
 * No cloud connection, adverts, permissions beyond microphone, or demo sounds.
 * Slot recordings and patterns are saved privately on the device.
 */
public class MainActivity extends Activity {
 static final int SR=22050, N=8, STEPS=32, MAX_SAMPLES=SR*5;
 static final int BG=0xff11100e, INK=0xfff5e8c8, MUTED=0xffa7a08a, ACID=0xffd9ff60,
   ORANGE=0xffff8d53, PANEL=0xff252119;
 final Slot[] slots=new Slot[N];
 volatile boolean running=true, playing=false;
 volatile int step=0;
 int selected=0;
 AudioTrack player;
 Thread audioThread;
 LinearLayout slotColumn, controlColumn;
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
  getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
  for(int i=0;i<N;i++){slots[i]=new Slot();restore(i);}
  bpm=getPreferences(0).getInt("bpm",76);
  show();
  startAudio();
 }
 @Override protected void onDestroy(){
  running=false;
  if(player!=null){try{player.pause();player.flush();player.release();}catch(Exception ignored){}}
  super.onDestroy();
 }
 @Override public void onBackPressed(){playing=false;super.onBackPressed();}
 void show(){
  LinearLayout root=vertical();root.setBackgroundColor(BG);root.setPadding(dp(13),dp(7),dp(13),dp(8));
  LinearLayout header=horizontal();
  TextView title=text("MICROVERSE_",27,ACID);header.addView(title,new LinearLayout.LayoutParams(0,dp(51),1));
  header.addView(button("◀ PARASITE",()->finish(),MUTED));
  root.addView(header);
  TextView subtitle=text("002 / TAPE ORGANISM    •    8 EMPTY CASSETTES    •    V3 / LOW FIDELITY",10,ORANGE);root.addView(subtitle);
  LinearLayout bar=horizontal();
  playButton=button("▶ RUN",()->{playing=!playing;playButton.setText(playing?"■ STOP":"▶ RUN");},ACID);
  bar.addView(playButton,new LinearLayout.LayoutParams(0,dp(44),1));
  bar.addView(button("–",()->{bpm=Math.max(35,bpm-2);getPreferences(0).edit().putInt("bpm",bpm).apply();updateStatus();},PANEL),new LinearLayout.LayoutParams(dp(42),dp(44)));
  bar.addView(button("+",()->{bpm=Math.min(210,bpm+2);getPreferences(0).edit().putInt("bpm",bpm).apply();updateStatus();},ORANGE),new LinearLayout.LayoutParams(dp(42),dp(44)));
  bar.addView(button("MANGLE",()->{masterWobble=Math.min(1,masterWobble+.16f);masterDust=Math.min(1,masterDust+.14f);refreshControls();},ORANGE),new LinearLayout.LayoutParams(dp(94),dp(44)));
  root.addView(bar);
  status=text("",11,MUTED);status.setPadding(0,dp(7),0,dp(6));root.addView(status);updateStatus();

  LinearLayout area=horizontal();area.setGravity(Gravity.TOP);
  ScrollView leftScroll=new ScrollView(this);slotColumn=vertical();leftScroll.addView(slotColumn);
  area.addView(leftScroll,new LinearLayout.LayoutParams(0,dp(265),2));
  ScrollView rightScroll=new ScrollView(this);controlColumn=vertical();controlColumn.setPadding(dp(10),0,0,0);rightScroll.addView(controlColumn);
  area.addView(rightScroll,new LinearLayout.LayoutParams(0,dp(265),3));
  root.addView(area);
  TextView legend=text("STEP MACHINE / TOUCH THE BLOCKS TO INFECT THE PATTERN",11,ACID);
  legend.setPadding(0,dp(6),0,dp(5));root.addView(legend);
  HorizontalScrollView gridScroll=new HorizontalScrollView(this);
  LinearLayout grid=vertical();grid.setBackgroundColor(PANEL);
  for(int lane=0;lane<N;lane++){
   final int index=lane;LinearLayout row=horizontal();
   TextView name=text(String.format("%02d",lane+1),12,lane==selected?ACID:INK);
   name.setGravity(Gravity.CENTER);row.addView(name,new LinearLayout.LayoutParams(dp(35),dp(30)));
   for(int i=0;i<STEPS;i++){
    final int s=i;TextView cell=text(" ",10,INK);cell.setGravity(Gravity.CENTER);
    boolean on=slots[lane].steps[i];
    cell.setBackgroundColor(on?ORANGE:(i%8==0?0xff574e38:0xff353025));
    LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(25),dp(24));lp.setMargins(dp(1),dp(2),dp(1),dp(2));row.addView(cell,lp);
    cell.setOnClickListener(v->{slots[index].steps[s]=!slots[index].steps[s];persist(index);cell.setBackgroundColor(slots[index].steps[s]?ORANGE:(s%8==0?0xff574e38:0xff353025));});
   }
   grid.addView(row);
  }
  gridScroll.addView(grid);root.addView(gridScroll,new LinearLayout.LayoutParams(-1,0,1));
  setContentView(root);
  refreshSlots();refreshControls();
 }
 void updateStatus(){if(status!=null)status.setText("TEMPO "+bpm+" BPM     /     DUST "+(int)(masterDust*100)+"%     /     WOW "+(int)(masterWobble*100)+"%     /     "+(playing?"TAPE ROLLING":"TAPE STOPPED"));}
 void refreshSlots(){
  if(slotColumn==null)return;slotColumn.removeAllViews();
  for(int i=0;i<N;i++){
   final int n=i;Slot slot=slots[i];boolean chosen=i==selected;
   TextView pad=button(String.format("%02d",i+1)+"  "+(slot.sample.length==0?"EMPTY TAPE":"● "+String.format("%.1f",slot.sample.length/(float)SR)+"s"),()->{selected=n;refreshSlots();refreshControls();},chosen?ACID:PANEL);
   if(!chosen)pad.setTextColor(INK);
   LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(35));lp.bottomMargin=dp(3);slotColumn.addView(pad,lp);
  }
 }
 void refreshControls(){
  if(controlColumn==null)return;controlColumn.removeAllViews();
  Slot s=slots[selected];slotName=text("TAPE "+String.format("%02d",selected+1)+" / "+(s.sample.length==0?"UNRECORDED":"RECORDED"),17,ACID);
  controlColumn.addView(slotName);
  LinearLayout actions=horizontal();
  actions.addView(button("● REC 5s",()->record(selected),ORANGE),new LinearLayout.LayoutParams(0,dp(42),1));
  actions.addView(button("IMPORT",()->importWav(),MUTED),new LinearLayout.LayoutParams(0,dp(42),1));
  actions.addView(button("ERASE",()->{slots[selected].sample=new short[0];slots[selected].active=false;persist(selected);refreshSlots();refreshControls();},MUTED),new LinearLayout.LayoutParams(0,dp(42),1));
  controlColumn.addView(actions);
  slider("LEVEL",s.level,v->{s.level=v;persist(selected);});
  slider("SPEED / PITCH",s.pitch/2,v->{s.pitch=.35f+v*1.65f;persist(selected);});
  slider("ATTACK",s.attack/.5f,v->{s.attack=v*.5f;persist(selected);});
  slider("RELEASE",s.release/2,v->{s.release=.03f+v*1.97f;persist(selected);});
  slider("START",s.start,v->{s.start=Math.min(v,s.end-.02f);persist(selected);});
  slider("END",s.end,v->{s.end=Math.max(v,s.start+.02f);persist(selected);});
  slider("PAN",(s.pan+1)/2,v->{s.pan=v*2-1;persist(selected);});
  slider("HIGH PASS",s.hp,v->{s.hp=v;persist(selected);});
  slider("LOW PASS",s.lp,v->{s.lp=v;persist(selected);});
  slider("TAPE ECHO SEND",s.echo,v->{s.echo=v;persist(selected);});
  slider("CATHEDRAL SEND",s.space,v->{s.space=v;persist(selected);});
  TextView fx=text("GLOBAL TAPE DESTRUCTION",13,ORANGE);fx.setPadding(0,dp(12),0,dp(2));controlColumn.addView(fx);
  slider("TOP END CUT",1-masterTone,v->{masterTone=1-v;updateStatus();});
  slider("WOW / FLUTTER",masterWobble,v->{masterWobble=v;updateStatus();});
  slider("DUST / SATURATION",masterDust,v->{masterDust=v;updateStatus();});
  slider("DELAY FEEDBACK",masterEcho,v->masterEcho=v);
  slider("CATHEDRAL",masterSpace,v->masterSpace=v);
 }
 interface Change{void set(float v);}
 void slider(String name,float initial,Change cb){
  LinearLayout row=horizontal();TextView label=text(name,10,INK);
  row.addView(label,new LinearLayout.LayoutParams(dp(158),dp(27)));
  SeekBar seek=new SeekBar(this);seek.setMax(100);seek.setProgress((int)(Math.max(0,Math.min(1,initial))*100));
  seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
   public void onProgressChanged(SeekBar b,int progress,boolean user){if(user)cb.set(progress/100f);}
   public void onStartTrackingTouch(SeekBar b){}
   public void onStopTrackingTouch(SeekBar b){}
  });
  row.addView(seek,new LinearLayout.LayoutParams(0,dp(30),1));controlColumn.addView(row);
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
    if(offset>0){short[] result=new short[offset];System.arraycopy(captured,0,result,0,offset);slots[index].sample=result;persist(index);}
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
    slots[index].sample=dst;persist(index);
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
     .putFloat("echo"+i,s.echo).putFloat("space"+i,s.space).apply();
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
     if(playing && counter%stepSamples==0){
      int beat=step;for(Slot slot:slots)if(slot.steps[beat]&&slot.sample.length>0){
       slot.active=true;slot.pos=slot.sample.length*slot.start;slot.age=0;slot.phase=random.nextDouble()*6.28;
      }
      step=(step+1)%STEPS;
     }
     float L=0,R=0,echoL=0,echoR=0,sendRoom=0;
     if(playing){
      for(Slot s:slots){
       short[] pcm=s.sample;if(!s.active||pcm.length<2)continue;
       int end=Math.max(2,Math.min(pcm.length,(int)(pcm.length*s.end)));
       int p=(int)s.pos;if(p<0||p>=end-1){s.active=false;continue;}
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
       float remain=(float)Math.max(0,(end-s.pos)/(SR*Math.max(.1,s.pitch)));
       env*=Math.min(1,remain/Math.max(.02,s.release));
       float v=held*env*s.level*.42f;
       float left=v*(1-s.pan)*.5f,right=v*(1+s.pan)*.5f;
       L+=left;R+=right;echoL+=left*s.echo;echoR+=right*s.echo;sendRoom+=v*s.space;
       s.pos+=s.pitch*wow;s.age++;
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
