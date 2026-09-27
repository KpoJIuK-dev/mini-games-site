var ii=0;if(typeof history.pushState==="function"){history.pushState("back",null,null);window.onpopstate=function(){history.pushState('back',null,null);};}
setTimeout(function(){ii=1;},200);