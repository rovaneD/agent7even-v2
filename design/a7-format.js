/* AGENT7EVEN · format data + platform-native preview renderer */
(function(){
  const FORMATS = {
    image:[
      {id:'ig-post',  pf:'ig',plat:'Instagram',name:'Post',  w:1080,h:1350,ratio:'4:5',   chrome:'ig'},
      {id:'ig-story', pf:'ig',plat:'Instagram',name:'Story', w:1080,h:1920,ratio:'9:16',  chrome:'story'},
      {id:'fb-post',  pf:'fb',plat:'Facebook', name:'Post',  w:1200,h:630, ratio:'1.91:1',chrome:'fb'},
      {id:'fb-cover', pf:'fb',plat:'Facebook', name:'Cover', w:820, h:312, ratio:'2.63:1',chrome:'cover'},
      {id:'x-post',   pf:'x', plat:'X',        name:'Post',  w:1200,h:675, ratio:'16:9',  chrome:'x'},
      {id:'x-header', pf:'x', plat:'X',        name:'Header',w:1500,h:500, ratio:'3:1',   chrome:'header'},
      {id:'li-post',  pf:'li',plat:'LinkedIn', name:'Post',  w:1200,h:627, ratio:'1.91:1',chrome:'li'},
      {id:'li-banner',pf:'li',plat:'LinkedIn', name:'Banner',w:1584,h:396, ratio:'4:1',   chrome:'libanner'}
    ],
    video:[
      {id:'ig-reels', pf:'ig',plat:'Instagram',name:'Reels', w:1080,h:1920,ratio:'9:16', chrome:'reels'},
      {id:'ig-story-v',pf:'ig',plat:'Instagram',name:'Story',w:1080,h:1920,ratio:'9:16', chrome:'storyv'},
      {id:'fb-reels', pf:'fb',plat:'Facebook', name:'Reels', w:1080,h:1920,ratio:'9:16', chrome:'reels'},
      {id:'tiktok',   pf:'tt',plat:'TikTok',   name:'Video', w:1080,h:1920,ratio:'9:16', chrome:'reels'},
      {id:'yt-shorts',pf:'yt',plat:'YouTube',  name:'Shorts',w:1080,h:1920,ratio:'9:16', chrome:'shorts'},
      {id:'li-video', pf:'li',plat:'LinkedIn', name:'Video', w:1080,h:1350,ratio:'4:5',  chrome:'liv'}
    ]
  };

  const U='agent7even', NAME='Agent7even';
  const IMG_CAP='Drop ends. Payout lands. Ship and go again.';
  const VID_CAP='Set your supply. Watch demand follow.';
  const ic=(n,c)=>window.A7.icon(n,c);
  const photo=cls=>'<div class="pv-photo '+(cls||'')+'"></div>';

  function reelSide(){
    return '<div class="reel-side">'+
      '<div class="ra">'+ic('heart')+'<span>4.2k</span></div>'+
      '<div class="ra">'+ic('comment')+'<span>318</span></div>'+
      '<div class="ra">'+ic('share')+'<span>96</span></div>'+
      '<div class="ra">'+ic('more')+'</div></div>';
  }

  const R = {
    ig:()=> '<div class="ig pv">'+
        '<div class="ig-hd"><div class="ava">7</div><div class="ig-nm">'+U+'</div>'+ic('more','ig-more')+'</div>'+
        '<div class="ig-media pv-photo"></div>'+
        '<div class="ig-act">'+ic('heart','acticon')+ic('comment','acticon')+ic('share','acticon')+
          '<span class="sp"></span>'+ic('bookmark','acticon')+'</div>'+
        '<div class="ig-likes">1,204 likes</div>'+
        '<div class="ig-cap"><b>'+U+'</b>'+IMG_CAP+'</div></div>',

    story:()=> '<div class="vert pv">'+photo()+
        '<div class="story-bars"><i class="on"></i><i></i><i></i></div>'+
        '<div class="vert-hd"><div class="ava">7</div><div class="nm">'+U+'<small>2h</small></div></div>'+
        '<div class="story-cap">'+IMG_CAP+'</div></div>',

    fb:()=> feed('fb','Sponsored',IMG_CAP,fbAct()),
    li:()=> feed('li','1d',IMG_CAP,liAct(),'Coffee that ships itself · Brand'),
    x:()=> '<div class="feed pv">'+
        '<div class="feed-hd"><div class="ava">7</div><div class="grow"><div class="nm">'+NAME+'</div>'+
          '<div class="mt"><span class="x-handle">@'+U+' · 2h</span></div></div>'+ic('more','ig-more')+'</div>'+
        '<div class="feed-txt">'+IMG_CAP+'</div>'+
        '<div class="feed-media x pv-photo"></div>'+
        '<div class="feed-act x-act">'+
          '<div class="a">'+ic('comment')+'<span>84</span></div>'+
          '<div class="a">'+ic('repeat')+'<span>212</span></div>'+
          '<div class="a">'+ic('heart')+'<span>1.4k</span></div>'+
          '<div class="a">'+ic('eye')+'<span>28k</span></div></div></div>',

    cover:()=> banner('cover','Ember Coffee Co.','Roastery · Coffee shop'),
    header:()=> banner('header',NAME,'@'+U),
    libanner:()=> banner('li','Ember Coffee Co.','Specialty coffee, shipped fresh weekly'),

    /* ---- video ---- */
    reels:()=> '<div class="vert pv">'+photo()+
        '<div class="play-c">'+ic('play')+'</div>'+reelSide()+
        '<div class="reel-foot"><div class="u">@'+U+'</div><div class="c">'+VID_CAP+'</div>'+
          '<div class="audio">'+ic('sound')+'<span>Original audio · '+NAME+'</span></div></div></div>',

    storyv:()=> '<div class="vert pv">'+photo()+
        '<div class="story-bars"><i class="on"></i><i></i></div>'+
        '<div class="vert-hd"><div class="ava">7</div><div class="nm">'+U+'<small>now</small></div></div>'+
        '<div class="play-c">'+ic('play')+'</div>'+
        '<div class="story-cap">'+VID_CAP+'</div></div>',

    shorts:()=> '<div class="vert pv">'+photo()+
        '<div class="play-c">'+ic('play')+'</div>'+
        '<div class="reel-side"><div class="ra">'+ic('thumbs-up')+'<span>12k</span></div>'+
          '<div class="ra">'+ic('comment')+'<span>540</span></div>'+
          '<div class="ra">'+ic('share')+'<span>Share</span></div>'+
          '<div class="ra">'+ic('more')+'</div></div>'+
        '<div class="reel-foot"><div class="u">@'+U+' · Shorts</div><div class="c">'+VID_CAP+'</div></div>'+
        '<div class="yt-bar"><i></i></div></div>',

    liv:()=> '<div class="feed pv">'+
        '<div class="feed-hd"><div class="ava">7</div><div class="grow"><div class="nm">'+NAME+'</div>'+
          '<div class="mt">Coffee that ships itself · Brand</div>'+
          '<div class="mt">1d · '+ic('globe')+'</div></div>'+ic('more','ig-more')+'</div>'+
        '<div class="feed-txt">'+VID_CAP+'</div>'+
        '<div class="feed-media liv pv-photo"><div class="play-c">'+ic('play')+'</div></div>'+
        liAct()+'</div>'
  };

  function feed(kind,time,cap,act,headline){
    const meta = headline
      ? '<div class="mt">'+headline+'</div><div class="mt">'+time+' · '+ic('globe')+'</div>'
      : '<div class="mt">'+time+' · '+ic('globe')+'</div>';
    return '<div class="feed pv">'+
      '<div class="feed-hd"><div class="ava">7</div><div class="grow"><div class="nm">'+NAME+'</div>'+meta+'</div>'+
      ic('more','ig-more')+'</div>'+
      '<div class="feed-txt">'+cap+'</div>'+
      '<div class="feed-media '+kind+' pv-photo"></div>'+act+'</div>';
  }
  function fbAct(){return '<div class="feed-act">'+
    '<div class="a">'+ic('thumbs-up')+'<span>Like</span></div>'+
    '<div class="a">'+ic('comment')+'<span>Comment</span></div>'+
    '<div class="a">'+ic('share')+'<span>Share</span></div></div>';}
  function liAct(){return '<div class="feed-act">'+
    '<div class="a">'+ic('thumbs-up')+'<span>Like</span></div>'+
    '<div class="a">'+ic('comment')+'<span>Comment</span></div>'+
    '<div class="a">'+ic('repeat')+'<span>Repost</span></div>'+
    '<div class="a">'+ic('share')+'<span>Send</span></div></div>';}
  function banner(kind,nm,h){
    return '<div class="banner pv"><div class="banner-img '+kind+' pv-photo"></div>'+
      '<div class="banner-row"><div class="ava">7</div><div class="meta"><div class="nm">'+nm+'</div>'+
      '<div class="h">'+h+'</div></div></div></div>';
  }

  function renderPreview(f){ return (R[f.chrome]||R.ig)(); }

  window.A7F = { FORMATS, renderPreview };
})();
