// Parasite V2 — billing integration readiness, intentionally NOT a payment gateway.
// Server-authoritative entitlements and webhooks must be added before activating a subscription.
// No client-controlled plan data is used for privileged decisions.
export default function handler(request){
 if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers:{Allow:'GET'}});
 return Response.json({
  version:'2.0.0',
  mode:'early_access',
  billingEnabled:false,
  checkoutEnabled:false,
  subscriptionRequired:false,
  accountRequired:false,
  trial:false,
  products:[],
  currentUser:null,
  entitlementSource:'not_configured',
  requiresForLaunch:['verified_authentication','server_side_checkout','verified_webhooks','entitlement_policy','customer_portal','refund_and_cancellation_pages'],
  message:'Parasite V2 is in early access. Subscription checkout is not active.'
 },{status:200,headers:{'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'}});
}
