/* Permission-based newsletter opt-in — no signup without explicit checkbox consent. */
(()=>{
  const API='https://backend-production-2b40.up.railway.app';
  const form=document.getElementById('orbit-radar-form');
  if(!form)return;
  const email=form.querySelector('input[type="email"]');
  const consent=form.querySelector('input[name="consent"]');
  const frequency=form.querySelector('select[name="frequency"]');
  const button=form.querySelector('button[type="submit"]');
  const feedback=document.getElementById('orbit-radar-feedback');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    feedback.textContent='';
    if(!email.value.trim()||!email.checkValidity()){feedback.textContent='Enter a valid email address.';email.focus();return}
    if(!consent.checked){feedback.textContent='Please opt in to recruiting updates first.';consent.focus();return}
    button.disabled=true;
    button.textContent='Requesting confirmation…';
    try{
      const response=await fetch(API+'/api/marketing/subscribe',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({email:email.value.trim(),consent:true,frequency:frequency.value})
      });
      if(!response.ok)throw new Error('Could not request a confirmation email. Please try again.');
      feedback.textContent='Check your inbox and confirm your subscription. No recruiting emails will be sent until you do.';
      form.reset();
    }catch(error){feedback.textContent=error?.message||'Subscriptions are temporarily unavailable.'}
    finally{button.disabled=false;button.textContent='Get recruiting updates →'}
  });
})();
