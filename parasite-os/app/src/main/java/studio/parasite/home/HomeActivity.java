package studio.parasite.home;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.Bitmap;
import android.net.Uri;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.*;

public class HomeActivity extends Activity {
    private static final String DEFAULT_URL = "https://parasite-kindle.vercel.app";
    private static final int IMMERSIVE = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
    private WebView web;
    private FrameLayout frame;
    private int settingsTaps = 0;
    private long lastTap = 0;

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE);
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        hideSystemUi();
        showHome();
    }

    @Override public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) hideSystemUi();
    }

    private TextView text(String message, int size, int colour) {
        TextView t = new TextView(this);
        t.setText(message);
        t.setTextSize(size);
        t.setTextColor(colour);
        t.setGravity(Gravity.CENTER);
        return t;
    }

    private Button button(String text, Runnable action) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setOnClickListener(v -> action.run());
        return b;
    }

    private void showHome() {
        if (web != null) { web.destroy(); web = null; }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(28,28,28,28);
        root.setBackgroundColor(Color.rgb(7,12,9));
        TextView brand = text("parasite", 58, Color.rgb(166,238,133));
        brand.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        root.addView(brand);
        root.addView(text("INSTRUMENT SYSTEM",12,Color.rgb(155,180,159)));
        root.addView(button("OPEN INSTRUMENTS", this::openWeb));
        root.addView(button("OPEN INSTALLED HUB",this::launchInstalledHub));
        root.addView(button("CHECK FOR UPDATES",this::openWeb));
        TextView foot = text("PARASITE HOME V2   •   SETTINGS",12,Color.rgb(120,145,125));
        foot.setPadding(12,48,12,15);
        root.addView(foot);
        foot.setOnClickListener(v -> showSettings());
        setContentView(root);
        hideSystemUi();
    }

    private String url() {
        return getPreferences(0).getString("hub_url",DEFAULT_URL);
    }

    private void openWeb() {
        if (web != null) {web.destroy(); web = null;}
        frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.BLACK);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(7,12,9));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
           @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
              if (request.isForMainFrame()) {
                 new AlertDialog.Builder(HomeActivity.this).setTitle("Hub unavailable")
                     .setMessage("The web Hub could not be loaded. Use the installed Hub or change the Hub address in Settings.")
                     .setPositiveButton("Installed Hub",(d,w)->launchInstalledHub())
                     .setNegativeButton("Settings",(d,w)->showSettings()).show();
              }
           }
        });
        frame.addView(web,new FrameLayout.LayoutParams(-1,-1));
        TextView gear=text("⚙",24,Color.rgb(166,238,133));
        FrameLayout.LayoutParams params=new FrameLayout.LayoutParams(72,72,Gravity.TOP|Gravity.RIGHT);
        frame.addView(gear,params);
        gear.setAlpha(.35f);
        gear.setOnClickListener(v->{
            long now=System.currentTimeMillis();
            if(now-lastTap>2200) settingsTaps=0;
            lastTap=now;
            if (++settingsTaps>=5) {settingsTaps=0;showSettings();}
        });
        setContentView(frame);
        hideSystemUi();
        web.loadUrl(url());
    }

    private void launchInstalledHub() {
        try {
            Intent intent=getPackageManager().getLaunchIntentForPackage("studio.transform.launcher");
            if(intent==null) throw new Exception("No installed hub");
            startActivity(intent);
        } catch(Exception e) {
            new AlertDialog.Builder(this).setMessage("Installed Parasite Hub not found.")
                .setPositiveButton("OK",null).show();
        }
    }

    private void showSettings() {
        final String[] options={"Return to Parasite Home","Change Hub website","Open installed Parasite Hub",
                                  "Return to Amazon Home","Open Android Settings"};
        new AlertDialog.Builder(this).setTitle("Parasite / Settings")
            .setItems(options,(d,which)-> {
                if(which==0)showHome();
                if(which==1)editUrl();
                if(which==2)launchInstalledHub();
                if(which==3)confirmAmazon();
                if(which==4)startActivity(new Intent(Settings.ACTION_SETTINGS));
            }).setNegativeButton("Close",(d,w)->hideSystemUi()).show();
    }

    private void editUrl() {
        EditText input=new EditText(this);
        input.setSingleLine(true);
        input.setText(url());
        new AlertDialog.Builder(this).setTitle("Hub website address").setView(input)
            .setPositiveButton("Save",(d,w)-> {
                String candidate=input.getText().toString().trim();
                Uri u=Uri.parse(candidate);
                if("https".equals(u.getScheme()) && u.getHost()!=null) {
                    getPreferences(0).edit().putString("hub_url",candidate).apply();
                    openWeb();
                } else new AlertDialog.Builder(this).setMessage("Enter a full HTTPS address.").setPositiveButton("OK",null).show();
            }).setNegativeButton("Cancel",null).show();
    }

    private void confirmAmazon() {
        new AlertDialog.Builder(this).setTitle("Return to Amazon Home?")
            .setMessage("Leave Parasite and open the original Fire OS Home screen?")
            .setPositiveButton("Return",(d,w)-> {
                try {
                    Intent i=new Intent(Intent.ACTION_MAIN);
                    i.setClassName("com.amazon.firelauncher","com.amazon.firelauncher.Launcher");
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(i);
                } catch(Exception e) {
                    startActivity(new Intent(Settings.ACTION_SETTINGS));
                }
            }).setNegativeButton("Stay in Parasite",null).show();
    }

    @Override public void onBackPressed() {
        if(web!=null && web.canGoBack()) web.goBack();
        else showHome();
    }
}
