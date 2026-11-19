package studio.transform.launcher;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
public class ApkProvider extends ContentProvider {
 @Override public boolean onCreate(){return true;}
 private File checked(Uri uri)throws FileNotFoundException {
  if(!"current".equals(uri.getLastPathSegment()))throw new FileNotFoundException();
  File f=new File(getContext().getCacheDir(),"downloaded.apk");
  if(!f.isFile())throw new FileNotFoundException();return f;
 }
 @Override public String getType(Uri uri){return "application/vnd.android.package-archive";}
 @Override public Cursor query(Uri u,String[] projection,String s,String[] args,String sort){
  try{
   File f=checked(u);
   if(projection==null)projection=new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE};
   MatrixCursor c=new MatrixCursor(projection);
   MatrixCursor.RowBuilder r=c.newRow();
   for(String p:projection)r.add(OpenableColumns.DISPLAY_NAME.equals(p)?"transform-instrument.apk":OpenableColumns.SIZE.equals(p)?f.length():null);
   return c;
  }catch(FileNotFoundException e){return null;}
 }
 @Override public ParcelFileDescriptor openFile(Uri u,String mode)throws FileNotFoundException{
  if(!"r".equals(mode))throw new FileNotFoundException();
  return ParcelFileDescriptor.open(checked(u),ParcelFileDescriptor.MODE_READ_ONLY);
 }
 @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
 @Override public int delete(Uri u,String s,String[] a){return 0;}
 @Override public int update(Uri u,ContentValues v,String s,String[] a){return 0;}
}
