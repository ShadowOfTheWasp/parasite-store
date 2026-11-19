package studio.parasite.melt;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.widget.*;
import android.content.res.ColorStateList;
import java.util.Random;

/** PARASITE 003 / MELT. Four bouncing tape-choir voices. Fully offline audio. */
public final class MainActivity extends Activity {
 static final int RATE=22050, BUF=1024, LANES=4;
 static final int BG=0xff11121a, PANEL=0xff222436, CREAM=0xffeee6d8, PINK=0xfff4a4c8, LIME=0xffd8ef82;
 static final int[] COLORS={0xfff2a8cb,0xff8adfdb,0xffdfc28d,0xffbaa9ef};
 static class Voice {
  volatile float wall=.60f,size=.52f,level=.82f;
  double transit=0, signal=0, phase=0, phase2=0, env=0, drift=0;
  boolean outbound=true;
  float last=0;
 }
 final Voice[] voices={new Voice(),new Voice(),new Voice(),new Voice()};
 volatile boolean running=true,play=false;
 volatile float feedback=.55f,wet=.62f,choir=.78f,flutter=.50f,brightness=.28f;
 AudioTrack track;
 Thread audioThread;
 PongView field;
 TextView status,playLabel;
 final Random rng=new Random();
 final float[] echoL=new float[RATE*3],echoR=new float[RATE*3];
 int echoIndex=0;
 long sampleClock=0;
 int dp(int a){return (int)(a*getResources().getDisplayMetrics().density+.5f);}
 TextView label(String t,int size,int c){
  TextView v=new TextView(this);v.setText(t);v.setTextColor(c);v.setTextSize(size);
  v.setTypeface(Typeface.MONOSPACE,Typeface.BOLD);return v;
 }
 TextView button(String t,Runnable action,int bg){
  TextView v=label(t,12,BG);v.setBackgroundTintList(ColorStateList.valueOf(bg));v.setBackgroundColor(bg);
  v.setGravity(17);v.setPadding(dp(12),dp(9),dp(12),dp(9));v.setOnClickListener(w->action.run());return v;
 }
 @Override public void onCreate(Bundle b) {
  super.onCreate(b);
  getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
  for(int i=0;i<4;i++){voices[i].wall=.48f+i*.12f;voices[i].size=.35f+i*.11f;}
  show();startAudio();
 }
 @Override protected void onDestroy(){
  running=false;
  if(audioThread!=null)audioThread.interrupt();
  super.onDestroy();
 }
 void show(){
  LinearLayout root=new LinearLayout(this);root.setOrientation(1);
  root.setPadding(dp(13),dp(8),dp(13),dp(8));root.setBackgroundColor(BG);
  LinearLayout top=new LinearLayout(this);top.setOrientation(0);top.setGravity(16);
  top.addView(label("MELT_",32,PINK),new LinearLayout.LayoutParams(0,dp(45),1));
  top.addView(button("◀ PARASITE",()->finish(),LIME));
  root.addView(top);
  root.addView(label("003   /   FOUR BOUNCING VOICES   /   MAGNETIC CHOIR ECHO",11,CREAM));
  field=new PongView(this);LinearLayout.LayoutParams fieldParams=new LinearLayout.LayoutParams(-1,0,1);
  fieldParams.topMargin=dp(10);root.addView(field,fieldParams);
  LinearLayout transport=new LinearLayout(this);transport.setGravity(16);
  playLabel=button("▶ DIVE IN",()->toggle(),LIME);
  transport.addView(playLabel,new LinearLayout.LayoutParams(0,dp(44),1));
  transport.addView(button("RESET BALLS",()->{
   play=false;for(Voice v:voices){v.transit=0;v.outbound=true;v.env=0;}
   playLabel.setText("▶ DIVE IN");updateStatus();
  },PINK),new LinearLayout.LayoutParams(0,dp(44),1));
  root.addView(transport);
  status=label("",10,CREAM);status.setPadding(0,dp(5),0,dp(6));root.addView(status);
  ScrollView scroller=new ScrollView(this);
  LinearLayout sliders=new LinearLayout(this);sliders.setOrientation(1);
  for(int i=0;i<LANES;i++){
   final int index=i;
   LinearLayout r=new LinearLayout(this);r.setGravity(16);
   TextView id=label("0"+(i+1),14,COLORS[i]);r.addView(id,new LinearLayout.LayoutParams(dp(35),dp(32)));
   slider(r,"WALL",voices[i].wall,x->voices[index].wall=x,.15f,1f);
   slider(r,"BALL",voices[i].size,x->voices[index].size=x,.1f,1f);
   sliders.addView(r);
  }
  sliders.addView(label("THE TAPE IS MELTING  /  MASTER MACHINE",11,PINK));
  LinearLayout fxA=new LinearLayout(this);fxA.setGravity(16);
  slider(fxA,"CHOIR",choir,x->choir=x,0,1);
  slider(fxA,"DELAY",wet,x->wet=x,0,1);
  sliders.addView(fxA);
  LinearLayout fxB=new LinearLayout(this);fxB.setGravity(16);
  slider(fxB,"DECAY",feedback,x->feedback=x,0,.92f);
  slider(fxB,"WOBBLE",flutter,x->flutter=x,0,1);
  sliders.addView(fxB);
  LinearLayout fxC=new LinearLayout(this);fxC.setGravity(16);
  slider(fxC,"TONE",brightness,x->brightness=x,.05f,.95f);
  sliders.addView(fxC);
  scroller.addView(sliders);
  root.addView(scroller,new LinearLayout.LayoutParams(-1,dp(190)));
  setContentView(root);updateStatus();
 }
 interface Change{void onChange(float x);}
 void slider(LinearLayout parent,String name,float initial,Change cb,float min,float max){
  LinearLayout group=new LinearLayout(this);group.setOrientation(1);
  TextView title=label(name,10,CREAM);group.addView(title);
  SeekBar seek=new SeekBar(this);seek.setMax(100);
  seek.setProgress(Math.round((initial-min)/(max-min)*100));
  seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
   public void onProgressChanged(SeekBar s,int p,boolean user){if(user)cb.onChange(min+(max-min)*p/100f);}
   public void onStartTrackingTouch(SeekBar s){}
   public void onStopTrackingTouch(SeekBar s){}
  });
  group.addView(seek,new LinearLayout.LayoutParams(-1,dp(27)));
  parent.addView(group,new LinearLayout.LayoutParams(0,dp(44),1));
 }
 void toggle(){
  play=!play;
  if(play){
   for(Voice v:voices){v.transit=0;v.outbound=true;v.env=1;v.phase=0;}
  }
  playLabel.setText(play?"■ FREEZE":"▶ DIVE IN");updateStatus();
 }
 void updateStatus(){if(status!=null)status.setText(play?"FOUR VOICES MOVING  /  WALL = TIME  /  BALL = TONE":"READY TO DIVE  /  TAP PLAY  /  DRAG THE WALLS");}
 final class PongView extends View {
  final Paint p=new Paint(3);
  PongView(Context c){super(c);setBackgroundColor(PANEL);}
  @Override protected void onDraw(Canvas c){
   super.onDraw(c);float w=getWidth(),h=getHeight(),left=dp(35);
   p.setTypeface(Typeface.create(Typeface.MONOSPACE,Typeface.BOLD));p.setTextSize(dp(12));
   for(int i=0;i<LANES;i++){
    Voice v=voices[i];float laneH=h/4,y=(i+.5f)*laneH;
    float wall=left+(w-left-dp(22))*v.wall;
    p.setColor(0xff404153);p.setStrokeWidth(dp(2));c.drawLine(left,y,wall,y,p);
    p.setColor(COLORS[i]);p.setStrokeWidth(dp(6));
    c.drawLine(left,y-laneH*.3f,left,y+laneH*.3f,p);
    c.drawLine(wall,y-laneH*.34f,wall,y+laneH*.34f,p);
    float distance=(float)(v.outbound?v.transit:1-v.transit);
    float pos=left+(wall-left)*Math.max(0,Math.min(1,distance));
    float radius=dp(5)+dp(10)*v.size;
    p.setAlpha(65);c.drawCircle(pos,y,radius*1.7f,p);
    p.setAlpha(255);c.drawCircle(pos,y,radius,p);
    p.setColor(CREAM);c.drawText("0"+(i+1),dp(8),y+dp(4),p);
   }
   if(running)postInvalidateDelayed(32);
  }
 }
 void startAudio(){
  int min=AudioTrack.getMinBufferSize(RATE,AudioFormat.CHANNEL_OUT_STEREO,AudioFormat.ENCODING_PCM_16BIT);
  if(min<=0){Toast.makeText(this,"Audio device unavailable",Toast.LENGTH_LONG).show();return;}
  track=new AudioTrack(AudioManager.STREAM_MUSIC,RATE,AudioFormat.CHANNEL_OUT_STEREO,AudioFormat.ENCODING_PCM_16BIT,Math.max(8192,min*2),AudioTrack.MODE_STREAM);
  track.play();
  audioThread=new Thread(()->{
   short[] buffer=new short[BUF*2];
   try{
    while(running){
     for(int frame=0;frame<BUF;frame++){
      double left=0,right=0;
      if(play){
       for(int i=0;i<LANES;i++){
        Voice v=voices[i];
        double travelSec=.15+v.wall*2.2;
        v.transit+=1/(RATE*travelSec);
        if(v.transit>=1){
         v.transit-=1;
         v.outbound=!v.outbound;
         v.env=1;
        }
        // A chorus-like bank of original additive voices, not licensed samples.
        double freq=(110+ i*36)*(1.35-.55*v.size);
        v.drift+=.000005*(1+flutter);
        double wow=1+flutter*(.009*Math.sin(sampleClock*.00029+i)+.004*Math.sin(sampleClock*.0023+i*2));
        v.phase+=2*Math.PI*freq*wow/RATE;
        v.phase2+=2*Math.PI*(freq*.997+ .5*Math.sin(v.drift))/RATE;
        double f=v.phase;
        double choirWave=(Math.sin(f)+.46*Math.sin(f*2.01)+.28*Math.sin(f*3.03)+
          .22*Math.sin(v.phase2)+.14*Math.sin(v.phase2*2.015))/2.1;
        double grain=(rng.nextDouble()-.5)*.011;
        double source=Math.tanh((choirWave*choir+grain)*2.4)*v.env*.22;
        // Low-pass tape head smooths aggressive high-frequency harmonics.
        float a=.012f+brightness*.26f;
        v.last+=a*((float)source-v.last);
        double out=v.last;
        v.env*=.99987;
        left+=out*(i%2==0?.78:.5);
        right+=out*(i%2==1?.78:.5);
       }
      }
      int index=echoIndex;
      int delaySamples=RATE/2;
      int read=(index-delaySamples+echoL.length)%echoL.length;
      float dl=echoL[read],dr=echoR[read];
      echoL[index]=(float)(left+dr*feedback);
      echoR[index]=(float)(right+dl*feedback);
      if(++echoIndex>=echoL.length)echoIndex=0;
      double a=play?(left+dl*wet):0,b=play?(right+dr*wet):0;
      buffer[frame*2]=(short)(Math.max(-1,Math.min(1,a))*32760);
      buffer[frame*2+1]=(short)(Math.max(-1,Math.min(1,b))*32760);
      sampleClock++;
     }
     track.write(buffer,0,buffer.length);
    }
   }catch(Exception ignored){}
   finally{try{track.stop();track.release();}catch(Exception ignored){}}
  },"melt-audio");audioThread.setPriority(Thread.MAX_PRIORITY);audioThread.start();
 }
}
