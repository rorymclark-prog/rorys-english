// Firebase Web API keys identify the public Auth project; they do not grant access.
var FIREBASE_PROJECT_ = "rory-automation";
var FIREBASE_WEB_KEY_ = "AIzaSyD-s8AsYroSl-KoLyDX8Os2nmyHODLcplA";
function firebaseLogin_(p) {
  var denied={ok:false,error:'Please sign in with your own verified account.'};
  if(typeof p.idToken!=='string'||p.idToken.length>12000||typeof p.code!=='string') return denied;
  var student=studentByAnyCode_(p.code);
  if(!student || student.code!==p.code) return denied;
  try {
    var parts=p.idToken.split('.');
    if(parts.length!==3) return denied;
    var claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
    var now=Math.floor(Date.now()/1000);
    if(claims.aud!==FIREBASE_PROJECT_ || claims.iss!=='https://securetoken.google.com/'+FIREBASE_PROJECT_ || !claims.sub || claims.exp<=now || claims.iat>now+30) return denied;
    // Google validates the supplied ID token. Claims above alone NEVER authenticate.
    var response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+FIREBASE_WEB_KEY_,{
      method:'post',contentType:'application/json',payload:JSON.stringify({idToken:p.idToken}),muteHttpExceptions:true
    });
    if(response.getResponseCode()!==200) return denied;
    var users=JSON.parse(response.getContentText()).users || [];
    if(users.length!==1) return denied;
    var user=users[0], permissions=JSON.parse(user.customAttributes || '{}');
    if(user.disabled || !user.emailVerified || user.localId!==claims.sub || permissions.studentCode!==student.code || permissions.role!=='student') return denied;
    // This scoped session cannot outlive the Firebase ID token used to open it.
    return issueSession_(student.code,'student',Math.min(3600,claims.exp-now));
  } catch(err) { return {ok:false,error:'Could not verify your account. Please try again.'}; }
}
