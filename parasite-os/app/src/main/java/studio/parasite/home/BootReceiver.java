package studio.parasite.home;
import android.content.*;
public class BootReceiver extends BroadcastReceiver { @Override public void onReceive(Context c, Intent i) { if(Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) { Intent start=new Intent(c,HomeActivity.class);start.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);try {c.startActivity(start);}catch(Exception e){} } } }
