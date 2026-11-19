package studio.transform.launcher;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.media.*;
import android.os.Bundle;
import android.os.Process;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** PARASITE V5. Standalone offline synthesizer and reversible startup proof of concept. */
public final class MainActivity extends Activity {
 private final Oscillator audio=new Oscillator();
 private Panel panel;
 private boolean bootEnabled;
 private static final String PREFS="parasite-settings";
 private static final int BG=0xff0a0e0b, GREEN=0xffa5f39f, WHITE=0xffe2e8d9, DIM=0xff829985;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  bootEnabled=getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean("launch-at-boot",false);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
  panel=new Panel(this);setContentView(panel);
  if(!audio.start())Toast.makeText(this,"Audio output could not start",Toast.LENGTH_LONG).show();
 }
 @Override protected void onResume(){super.onResume();getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);audio.start();}
 @Override protected void onPause(){audio.stop();super.onPause();}
 @Override protected void onDestroy(){audio.stop();super.onDestroy();}
 private void setAutostart(boolean enable){
  bootEnabled=enable;
  getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean("launch-at-boot",enable).apply();
  Toast.makeText(this,enable?"Start-at-boot enabled. Restart Kindle to test.":"Start-at-boot disabled",Toast.LENGTH_LONG).show();
  panel.invalidate();
 }
 private static final class Oscillator{
  final AtomicBoolean running=new AtomicBoolean(false);
  volatile float cutoff=.65f,resonance=.15f,drive=.22f,octave=.48f,detune=.40f,release=.38f,volume=.48f,shape=.6f;
  volatile int note=48;
  volatile boolean held=false;
  private volatile AudioTrack track;
  private Thread thread;
  private int sr=48000;
  private double p1=0,p2=0,f1=0,f2=0,f3=0;
  private float envelope=0,currentHz=130.81f;
  static float clamp(float v,float min,float max){return Math.max(min,Math.min(max,v));}
  static double osc(double p,float shape){return (1-shape)*(2*p-1)+shape*(p<.5?1:-1);}
  synchronized boolean start(){
   if(running.get())return true;
   int n=AudioTrack.getNativeOutputSampleRate(AudioManager.STREAM_MUSIC);
   sr=n>=8000&&n<=96000?n:48000;
   int min=AudioTrack.getMinBufferSize(sr,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT);
   if(min<=0)return false;
   try{
    AudioAttributes a=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
    AudioFormat f=new AudioFormat.Builder().setSampleRate(sr).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build();
    track=new AudioTrack(a,f,Math.max(8192,min*2),AudioTrack.MODE_STREAM,AudioManager.AUDIO_SESSION_ID_GENERATE);
    if(track.getState()!=AudioTrack.STATE_INITIALIZED){track.release();track=null;return false;}
    running.set(true);track.play();thread=new Thread(this::render,"parasite-osc");thread.start();
    return true;
   }catch(Exception e){running.set(false);if(track!=null)track.release();track=null;return false;}
  }
  private void render(){
   Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
   short[] pcm=new short[256];
   while(running.get()){
    float target=(float)(440*Math.pow(2,(note-69)/12.));
    for(int i=0;i<pcm.length;i++){
     currentHz+=(target-currentHz)*.005f;
     float envTime=held?.007f:(.05f+release*2.4f);
     float envTarget=held?1:0;
     envelope+=(envTarget-envelope)*Math.min(1,1/(envTime*sr));
     double hz=currentHz*Math.pow(2,(octave-.5)*2);
     p1+=hz/sr;p1-=Math.floor(p1);
     p2+=hz*Math.pow(2,(detune-.5)*.11)/sr;p2-=Math.floor(p2);
     double x=(osc(p1,shape)+osc(p2,.4f))*.29;
     x=Math.tanh(x*(1+drive*8));
     double fc=Math.max(40,Math.min(sr*.3,45*Math.pow(2,cutoff*9)));
     double a=1-Math.exp(-2*Math.PI*fc/sr);
     double input=Math.tanh(x-f3*resonance*3);
     f1+=a*(input-f1);f2+=a*(f1-f2);f3+=a*(f2-f3);
     double sample=Math.tanh(f3*envelope*volume*1.9);
     pcm[i]=(short)(clamp((float)sample,-.90f,.90f)*32767);
    }
    AudioTrack t=track;if(t==null)break;
    try{if(t.write(pcm,0,pcm.length,AudioTrack.WRITE_BLOCKING)<=0)break;}catch(Exception e){break;}
   }
  }
  synchronized void stop(){
   running.set(false);held=false;
   AudioTrack t=track;
   if(t!=null)try{t.pause();t.flush();}catch(Exception ignored){}
   if(thread!=null&&thread!=Thread.currentThread())try{thread.join(700);}catch(InterruptedException e){Thread.currentThread().interrupt();}
   thread=null;track=null;
   if(t!=null)try{t.release();}catch(Exception ignored){}
  }
 }
 private final class Panel extends View {
  private final Paint paint=new Paint(3);
  private final String[] names={"CUTOFF","RESONANCE","DRIVE","OCTAVE","DETUNE","RELEASE","VOLUME","SHAPE"};
  private final float[] xPositions={80,201,322,443,564,685,806,927};
  private int selectedKnob=-1,playedKey=-1;
  private float startY,startVal,sx=1,sy=1;
  Panel(Context c){super(c);}
  private void fill(int color){paint.setColor(color);paint.setStyle(Paint.Style.FILL);}
  private void rect(Canvas c,float x,float y,float w,float h,int color){fill(color);c.drawRect(x,y,x+w,y+h,paint);}
  private void text(Canvas c,String value,float x,float y,int size,int color,boolean bold){
   fill(color);paint.setTextSize(size);
   paint.setTypeface(Typeface.create("monospace",bold?Typeface.BOLD:Typeface.NORMAL));
   paint.setTextAlign(Paint.Align.CENTER);c.drawText(value,x,y,paint);
  }
  private float[] values(){return new float[]{audio.cutoff,audio.resonance,audio.drive,audio.octave,audio.detune,audio.release,audio.volume,audio.shape};}
  private void setValue(int i,float v){
   v=Oscillator.clamp(v,0,1);
   switch(i){
    case 0:audio.cutoff=v;break;case 1:audio.resonance=v;break;
    case 2:audio.drive=v;break;case 3:audio.octave=v;break;
    case 4:audio.detune=v;break;case 5:audio.release=v;break;
    case 6:audio.volume=v;break;case 7:audio.shape=v;break;
   }
   invalidate();
  }
  @Override protected void onDraw(Canvas canvas){
   super.onDraw(canvas);
   sx=getWidth()/1024f;sy=getHeight()/600f;canvas.save();canvas.scale(sx,sy);canvas.drawColor(BG);
   rect(canvas,0,0,1024,65,0xff17211a);
   text(canvas,"PARASITE_",154,42,34,GREEN,true);
   text(canvas,"OSC / BOOT TEST V5",614,39,21,WHITE,true);
   rect(canvas,13,77,998,324,0xff19221c);
   text(canvas,"STANDALONE INSTRUMENT • OFFLINE AUDIO ENGINE",500,116,16,DIM,false);
   float[] vals=values();
   for(int i=0;i<8;i++){
    float x=xPositions[i],y=225;
    text(canvas,names[i],x,165,12,WHITE,true);
    fill(0xff6c7870);canvas.drawCircle(x,y,39,paint);
    fill(0xff252d28);canvas.drawCircle(x,y,34,paint);
    fill(0xff131a15);canvas.drawCircle(x,y,27,paint);
    double angle=Math.toRadians(-130+vals[i]*260);
    paint.setColor(GREEN);paint.setStrokeWidth(5);
    canvas.drawLine(x,y,x+(float)Math.sin(angle)*26,y-(float)Math.cos(angle)*26,paint);
    text(canvas,""+(int)(vals[i]*100)+"%",x,294,14,GREEN,true);
   }
   rect(canvas,30,323,300,55,bootEnabled?0xffa5f39f:0xff5a7960);
   text(canvas,bootEnabled?"START AT BOOT: ON":"ENABLE START AT BOOT",180,358,16,BG,true);
   rect(canvas,350,323,302,55,0xffb5ae94);text(canvas,"EXIT TO FIRE OS",501,358,16,BG,true);
   text(canvas,"FIRST OPEN → ENABLE BOOT → RESTART TO TEST",819,342,11,WHITE,false);
   text(canvas,"Auto-start is best-effort on Fire OS",819,363,10,DIM,false);
   rect(canvas,0,414,1024,186,0xff3b3328);
   text(canvas,"TOUCH KEYBOARD / C3–G5",165,432,12,WHITE,true);
   int[] scale={0,2,4,5,7,9,11};float w=980f/19;
   for(int i=0;i<19;i++){
    int n=48+(i/7)*12+scale[i%7];
    rect(canvas,20+i*w,447,w-2,143,n==playedKey?0xffbfe0b7:0xffebebdc);
   }
   for(int i=0;i<18;i++){
    int pitch=scale[i%7];if(pitch==4||pitch==11)continue;
    float keyX=20+(i+1)*w;
    int midi=48+(i/7)*12+pitch+1;
    rect(canvas,keyX-w*.28f,447,w*.56f,85,midi==playedKey?0xff8bbe95:0xff111613);
   }
   canvas.restore();
  }
  private int keyAt(float x,float y){
   if(y<447||y>595||x<20||x>=1000)return -1;
   int[] scale={0,2,4,5,7,9,11};float w=980f/19;
   int white=(int)((x-20)/w);
   if(white<0||white>=19)return -1;
   if(y<532)for(int i=0;i<18;i++){
    int pitch=scale[i%7];if(pitch==4||pitch==11)continue;
    float at=20+(i+1)*w;
    if(x>=at-w*.28&&x<=at+w*.28)return 48+(i/7)*12+pitch+1;
   }
   return 48+(white/7)*12+scale[white%7];
  }
  @Override public boolean onTouchEvent(MotionEvent e){
   int action=e.getActionMasked();float x=e.getX()/Math.max(.1f,sx),y=e.getY()/Math.max(.1f,sy);
   if(action==MotionEvent.ACTION_DOWN){
    if(y>320&&y<383){
     if(x>=30&&x<=330){setAutostart(!bootEnabled);return true;}
     if(x>=350&&x<=652){audio.held=false;finish();return true;}
    }
    if(y>=447){playedKey=keyAt(x,y);if(playedKey>=0){audio.note=playedKey;audio.held=true;}invalidate();return true;}
    for(int i=0;i<8;i++)if(Math.abs(x-xPositions[i])<44&&Math.abs(y-225)<48){
     selectedKnob=i;startY=y;startVal=values()[i];return true;
    }
   }else if(action==MotionEvent.ACTION_MOVE){
    if(selectedKnob>=0){setValue(selectedKnob,startVal+(startY-y)/170);return true;}
    if(playedKey>=0){
     int next=keyAt(x,y);
     if(next>=0&&next!=playedKey){playedKey=next;audio.note=next;invalidate();}
    }
   }else if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){
    selectedKnob=-1;playedKey=-1;audio.held=false;invalidate();return true;
   }
   return true;
  }
 }
}