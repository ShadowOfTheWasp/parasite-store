package studio.transform.launcher;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
/** Best-effort boot launch on Fire OS 7. User can disable from PARASITE settings. */
public final class BootReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  if(!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()))return;
  if(!context.getSharedPreferences("parasite-settings",Context.MODE_PRIVATE)
    .getBoolean("launch-at-boot",false))return;
  Intent launch=new Intent(context,MainActivity.class);
  launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  try{context.startActivity(launch);}catch(Exception ignored){}
 }
}