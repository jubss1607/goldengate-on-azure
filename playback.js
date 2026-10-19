/* Scroll selects a block. Elapsed time, never scroll distance, animates it. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BlockPlayback=factory();
})(typeof window==='undefined'?this:window,function(){
  'use strict';
  const durations=[2.2,2.4,2.4,2.8,2.8,3.2,3.4,3.8,2.4];
  const clamp=v=>Math.max(0,Math.min(1,v));
  function sceneAt(y,tops,height){
    // Activate when the block reaches the middle of the viewport, not its end.
    const probe=y+height*.45;
    let index=0;
    for(let i=1;i<tops.length;i++)if(probe>=tops[i])index=i;
    return index;
  }
  function create(){
    let scene=-1,progress=0,manual=false;
    return {
      enter(index){if(index===scene)return false;scene=index;progress=0;manual=false;return true;},
      replay(){progress=0;manual=false;},
      seek(value){progress=clamp(value);manual=true;},
      tick(seconds,{paused=false,reduced=false,hidden=false,covered=false}={}){
        if(reduced){progress=1;return progress;}
        if(!paused&&!hidden&&!covered&&!manual&&scene>=0)
          progress=clamp(progress+Math.max(0,seconds)/durations[scene]);
        return progress;
      },
      get progress(){return progress;}
    };
  }
  return {create,sceneAt,durations};
});
