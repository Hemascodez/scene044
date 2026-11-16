/**
 * Google Analytics 4.
 *
 * Inert unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set, so local development and
 * preview deploys never pollute the property with fake traffic — and so a
 * missing key is a no-op rather than a broken page.
 *
 * The inline bootstrap keeps route and payload privacy controls in one place
 * without adding a runtime dependency.
 *
 * Pageviews are explicit and URL context is allowlisted. In the GA web stream,
 * disable Enhanced Measurement (including history pageviews, forms, outbound
 * clicks and site search): send_page_view:false only disables config's initial
 * pageview, not the stream's independent automatic collection. Leaving that
 * collection enabled can duplicate pageviews and bypass these privacy guards.
 */

/** Measurement IDs are G-XXXXXXX. Validated rather than interpolated blindly —
 *  this value lands inside an inline <script>, so it must not carry quotes. */
export function gaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id && /^G-[A-Z0-9]+$/i.test(id) ? id : null;
}

export function gaInlineScript(id: string): string {
  if (!/^G-[A-Z0-9]+$/i.test(id)) return '';
  // Keep this as browser JavaScript, not a function serialized with toString():
  // build tools can introduce closure references into serialized functions.
  return String.raw`(function(){try{
    var id=${JSON.stringify(id)};
    if(!/^https:\/\/(?:www\.)?scene044\.in$/.test(window.location.origin)||window.__sceneAnalyticsPrivacy)return;
    window.__sceneAnalyticsPrivacy=true;
    window.dataLayer=window.dataLayer||[];
    var origin=window.location.origin,ready=false,last,referrer='';
    var campaigns={utm_source:'campaign_source',utm_medium:'campaign_medium',utm_campaign:'campaign_name',utm_id:'campaign_id',utm_term:'campaign_term',utm_content:'campaign_content'};
    function queue(){window.dataLayer.push(arguments);}
    function publicUrl(value){
      var url=new URL(value,origin);
      if(url.origin!==origin||url.protocol!=='https:')return '';
      var path=url.pathname;
      if(!/^(?:\/|\/(?:privacy|terms)\/?|\/category\/[a-z0-9-]+\/?|\/events\/[a-z0-9-]+-\d+\/?|\/events\/chennai\/[a-z0-9-]+\/?|\/venues(?:\/[a-z0-9-]+)?\/?)$/.test(path))return '';
      for(var key of url.searchParams.keys())if(/ticket|token|secret|password|email|phone|signature|payment|authorization|^otp$|^code$/i.test(key))return '';
      return origin+(path==='/'?path:path.replace(/\/$/,''));
    }
    // History can update before Next replaces the previous document's head.
    // Read the title once, only on a public landing, and bind it to that URL.
    var initialPage=publicUrl(window.location.href),initialTitle='';
    if(initialPage){
      var title=document.title;
      if(typeof title==='string'&&title.trim()&&title.length<=300&&!/[\u0000-\u001f\u007f]|@|https?:\/\/|(?:\d[\s()+-]*){7}|[a-f0-9]{32}|(?:pay|order)_[a-z0-9]+/i.test(title))initialTitle=title;
    }
    function publicTitle(location){
      if(location===initialPage)return initialTitle||'SCENE';
      var path=new URL(location).pathname;
      var titles={'/':'Chennai events — SCENE','/venues':'Venues — SCENE','/venues/search':'Venue search — SCENE','/venues/partner':'Venue partners — SCENE','/privacy':'Privacy — SCENE','/terms':'Terms — SCENE'};
      return titles[path]||(/^\/venues\//.test(path)?'Venue — SCENE':/^\/events\/chennai\//.test(path)?'Chennai events — SCENE':/^\/events\//.test(path)?'Event — SCENE':'Category events — SCENE');
    }
    try{
      if(document.referrer){
        var from=new URL(document.referrer);
        referrer=from.origin===origin?publicUrl(from.href):(/^https?:$/.test(from.protocol)?from.origin:'');
      }
    }catch(_){}
    function safeCampaign(value){
      // Campaign labels, not arbitrary query text or identifiers. Do not truncate
      // invalid values: a shortened secret is still a secret.
      return typeof value==='string'&&value.length<=64&&/^[a-z0-9]+(?:[ _-][a-z0-9]+)*$/i.test(value)
        &&!/(?:\d[ _-]*){7}|[a-f0-9]{16}|[a-z0-9]{24}/i.test(value)
        &&!/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i.test(value)
        &&!/(?:^|[ _-])(?:ticket|token|secret|password|auth|authorization|bearer|session|otp|pay|order|signature)(?:$|[ _-])/i.test(value);
    }
    function context(location,ref){
      var fields={page_location:location,page_referrer:ref,page_title:'SCENE'};
      // A synthetic venue location on /bookings must never authorize its
      // private document's title or campaign parameters.
      if(publicUrl(window.location.href)!==location)return fields;
      fields.page_title=publicTitle(location);
      var query=new URL(window.location.href).searchParams;
      for(var key in campaigns){
        var values=query.getAll(key);
        if(values.length===1&&safeCampaign(values[0]))fields[campaigns[key]]=values[0];
      }
      return fields;
    }
    function setContext(fields){
      // Clear explicit overrides between pages; GA retains its own session
      // attribution. Never carry private-query or stale mixed campaign values.
      var clear={};
      for(var key in campaigns)clear[campaigns[key]]=null;
      queue('set',Object.assign(clear,fields));
    }
    function initialise(fields){
      if(ready)return;
      setContext(fields);
      queue('js',new Date());
      queue('config',id,{send_page_view:false,page_location:fields.page_location,page_referrer:fields.page_referrer,page_title:fields.page_title});
      ready=true;
    }
    function observe(){try{
      var next=publicUrl(window.location.href);
      window.gtag=next||/^\/bookings\/?$/.test(window.location.pathname)?send:undefined;
      if(next===last)return;
      var previous=last===undefined?referrer:(last||'');
      last=next;
      var fields=context(next||origin,previous);
      if(!next){if(ready)setContext(context(origin,''));return;}
      initialise(fields);
      setContext(fields);
      queue('event','page_view',fields);
    }catch(_){}}
    // Callers already catch queue errors. Preserve that signal so a blocked
    // analytics queue does not mark an unsent purchase as delivered locally.
    function send(action,name,params){
      if(action!=='event'||!params)return;
      var current=publicUrl(window.location.href);
      var booking=/^\/bookings\/?$/.test(window.location.pathname);
      var hosted=/^\/events\/[^/]+\/?$/.test(window.location.pathname)&&!!current;
      var venue=(/^\/venues\/[^/]+\/?$/.test(window.location.pathname)&&!!current)||booking;
      if(!(hosted&&/^(?:view_item|scene_registration_open|scene_otp_sent|scene_otp_verified|scene_details_completed|begin_checkout|scene_checkout_dismissed|scene_payment_failed|purchase)$/.test(name))&&!(venue&&/^(?:generate_lead|begin_checkout|purchase)$/.test(name)))return;
      if(!Number.isFinite(params.value)||params.value<0||!Array.isArray(params.items)||params.items.length!==1)return;
      var item=params.items[0];
      if(!item||typeof item.item_id!=='string'||!(hosted?/^scene-event-\d+$/:/^[a-z0-9-]+\/[a-z0-9-]+$/i).test(item.item_id))return;
      // Private booking pages still emit verified conversions, attributed to
      // the public venue rather than the booking path or its referral code.
      var fields=context(current||origin+'/venues/'+item.item_id.split('/')[0],last===current?'':(last||''));
      var safe=Object.assign({currency:'INR',value:params.value,transport_type:'beacon',items:[{item_id:item.item_id,item_category:hosted?'Hosted event':'Venue booking',quantity:1,price:params.value}]},fields);
      if(hosted&&/^\d+$/.test(params.scene_event_id))safe.scene_event_id=params.scene_event_id;
      if(name==='purchase'){
        if(typeof params.transaction_id!=='string'||!(hosted?/^evt-\d+-[a-f0-9]{32}$/:/^SCN-[a-z0-9]+$/i).test(params.transaction_id))return;
        safe.transaction_id=params.transaction_id;
      }
      initialise(fields);
      setContext(fields);
      queue('event',name,safe);
    }
    for(var method of ['pushState','replaceState'])(function(method){
      var original=window.history[method];
      window.history[method]=function(){var result=original.apply(this,arguments);observe();return result;};
    })(method);
    window.addEventListener('popstate',observe);
    observe();
  }catch(_){}})();`;
}
