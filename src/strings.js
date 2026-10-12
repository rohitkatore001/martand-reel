// Every on-screen / subtitle string of the reel (script #1). Scenes should use these constants
// so the text test sheet always covers exactly what appears in the video.
(function (root) {
  const PRICE = { mrp: '१३०', offer: '१००' }; // change the offer here (Devanagari digits)
  const S = {
    hook: 'हा आवाज ओळखीचा वाटतोय?',
    vo1a: 'शहरात सगळं मिळतं…',
    vo1b: 'पण संध्याकाळच्या चहासोबत ती गावाकडची चव…',
    vo1c: 'काही मिळत नाही.',
    aaji1: 'अरे, हळू खा रे!',
    vo2: 'आजीचा तो डबा… आणि त्यातलं मूठभर फरसाण…',
    friend: 'घे, तुझ्यासाठी आणलंय!',
    aajiEcho: 'हळू खा रे…',
    brand: 'मार्तंड',
    product: 'फरसाण',
    brandFull: 'मार्तंड फरसाण',
    tagline: 'अस्सल गावाकडची चव',
    m1: 'चहासोबत…',
    m2: 'पोह्यावर भुरभुरा…',
    m3: 'कांदा-टोमॅटो-लिंबू पिळा, झटपट चटकदार भेळ!',
    m4: 'मिसळीवर टाका…',
    m5: 'प्रवासात डब्यात…',
    m6: 'आणि पाहुणे आले की ताटात!',
    labels: ['चहासोबत', 'पोह्यावर', 'झटपट भेळ', 'मिसळीवर', 'प्रवासात', 'पाहुण्यांसाठी'],
    ingredients: ['बेसन', 'पोहे', 'चणा डाळ', 'मसूर डाळ', 'हळद', 'काळं मीठ'],
    vo3a: 'चण्याचं बेसन, पोहे, चणा डाळ, मसूर डाळ,',
    vo3b: 'हळद आणि काळं मीठ…',
    vo3c: 'साधं, घरचं, अस्सल.',
    vo4: 'चव तीच… आठवणी त्याच.',
    vo5: 'मार्तंड फरसाण… अस्सल गावाकडची चव!',
    weight: '५०० ग्रॅम',
    mrp: 'MRP ₹' + PRICE.mrp,
    offer: 'आता फक्त ₹' + PRICE.offer,
    phone: '6262515194',
    cta: 'आजच मागवा!',
    end: 'येळकोट येळकोट… जय मल्हार!',
    // pack / end-card details
    maker: 'मार्तंड एंटरप्रायझेस',
    place: 'राहुरी, जि. अहिल्यानगर',
    netwt: 'निव्वळ वजन: ५०० ग्रॅम',
    shops: 'अहिल्यानगर परिसरातील दुकानांत उपलब्ध',
  };
  root.REEL_STRINGS = S;
  root.REEL_PRICE = PRICE;
  if (typeof module !== 'undefined' && module.exports) module.exports = { S, PRICE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
