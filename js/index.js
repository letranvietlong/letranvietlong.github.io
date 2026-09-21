
// -- CURSOR --
const cur=document.getElementById('cur'),ring=document.getElementById('cur-r');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
(function t(){cur.style.left=mx+'px';cur.style.top=my+'px';rx+=(mx-rx)*.1;ry+=(my-ry)*.1;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(t);})();
document.querySelectorAll('a,button,[onclick]').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ring.style.width='52px';ring.style.height='52px';ring.style.opacity='.15';});
  el.addEventListener('mouseleave',()=>{ring.style.width='40px';ring.style.height='40px';ring.style.opacity='.35';});
});

// -- SPA ROUTER --
function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a=>a.classList.remove('active'));
  const page = document.getElementById('page-'+id);
  const nav  = document.getElementById('nav-'+id);
  if(page) page.classList.add('active');
  if(nav)  nav.classList.add('active');
  window.scrollTo({top:0,behavior:'instant'});
  // Stop snake if leaving games page
  if(id !== 'games' && typeof gameState !== 'undefined') {
    if(gameState.snakeInterval) clearInterval(gameState.snakeInterval);
    if(gameState.reactionTimeout) clearTimeout(gameState.reactionTimeout);
    if(gameState.pongRAF) cancelAnimationFrame(gameState.pongRAF);
    if(gameState.flappyRAF) cancelAnimationFrame(gameState.flappyRAF);
    gameState = {};
  }
  // Reset blog state khi rời Blog page
  if(id !== 'blog') {
    if(typeof blogShowAll !== 'undefined') { blogShowAll = false; }
  }
  // Home page needs grid layout
  const homeEl = document.getElementById('page-home');
  if(id === 'home') {
    homeEl.style.display = 'grid';
  } else {
    homeEl.style.display = 'none';
  }
  // Reset blog filter khi vào trang blog
  if(id === 'blog') {
    setTimeout(() => { blogFilter='all'; filterBlog(); }, 50);
  }
}
// Menu di động (hamburger) — .nav-links bị ẩn ở màn hình hẹp (media query),
// đây là cách điều hướng duy nhất trên điện thoại.
function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
}
function mobileNav(el) {
  document.querySelectorAll('.mobile-menu a').forEach(a=>a.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('mobileMenu').classList.remove('open');
}
// -- BLOG POSTS DATA --
const BASE=[
  {title:"Dọn nhà kho code sau 2 năm: Tái cấu trúc toàn bộ site cá nhân",cat:"Tech",date:"20 Sep 2026",body:`<p>Site cá nhân này bắt đầu chỉ với vài file HTML nằm thẳng ở thư mục gốc. Hai năm sau, con số đó đã lên tới hơn chục sản phẩm — mỗi cái một kiểu đặt tên, một cách tổ chức khác nhau.</p><p>Tuần trước tôi quyết định dọn dẹp triệt để: mọi sản phẩm chuyển vào <code>products/</code>, đặt tên kebab-case thống nhất, và bên trong mỗi sản phẩm lại tách theo đúng loại file — <code>html/</code>, <code>css/</code>, <code>js/</code>, <code>data/</code>.</p><p><strong>Khó nhất không phải là di chuyển file</strong> — mà là rà soát hết mọi nơi tự tham chiếu tới đường dẫn cũ: canonical URL, service worker cache list, workflow CI, thậm chí cả URL đã đăng ký với bên thứ ba cho chính sách bảo mật.</p><p>Bài học lớn nhất: cấu trúc thư mục không phải chuyện làm một lần rồi xong — nó cần được xem lại định kỳ, giống như bất kỳ khoản nợ kỹ thuật nào khác.</p>`},
  {title:"Bug âm thầm 6 tháng: Khi sổ sách \"tưởng đúng\" lại tính nhầm lãi",cat:"Tech",date:"05 Sep 2026",body:`<p>GoldTrack — app theo dõi giá vàng của tôi — có một tính năng ghi sổ giao dịch mua/bán để tính lời lỗ. Một hôm tôi thử nhập một giao dịch bán với ngày lùi về trước một giao dịch mua, và phát hiện ra: app báo lãi hơn 29 triệu đồng trên một khoản đầu tư chỉ đáng giá 26 triệu.</p><p><strong>Nguyên nhân:</strong> logic validate giao dịch bán chỉ kiểm tra tổng số dư hiện tại, bỏ qua thứ tự thời gian thực sự của các giao dịch. Một giao dịch bán "hợp lệ" theo tổng số nhưng lại không hợp lệ nếu xét theo đúng trình tự ngày tháng.</p><p>Cách vá: thay vì kiểm tra tổng số dư, tôi viết lại hàm để "replay" toàn bộ lịch sử giao dịch theo đúng thứ tự thời gian, và từ chối ngay tại điểm đầu tiên số dư có thể âm.</p><p>Bug này đã nằm im từ ngày đầu viết app — chỉ lộ ra khi tôi vô tình thử một kịch bản dữ liệu bất thường. Bài học: logic tài chính luôn cần test case cho dữ liệu "sai thứ tự", không chỉ dữ liệu "sai giá trị".</p>`},
  {title:"Tôi để AI tái cấu trúc một repo lớn — đây là điều tôi học được",cat:"Work",date:"20 Aug 2026",body:`<p>Lần đầu tiên tôi giao hẳn một việc lớn — tái cấu trúc toàn bộ repo — cho AI làm gần như từ đầu đến cuối, tôi chỉ đưa ra yêu cầu và duyệt lại kết quả.</p><p><strong>Điều bất ngờ nhất:</strong> AI không chỉ đổi tên file, mà còn tự phát hiện ra những chỗ tôi chưa từng nghĩ tới — ví dụ một URL tự tham chiếu bên trong chính trang đó, hoặc một service worker sẽ mất tác dụng offline nếu đặt sai thư mục.</p><p>Nhưng cũng có lúc phải tự mình sửa lại: AI đưa ra một số quyết định kiến trúc hợp lý về mặt kỹ thuật nhưng chưa khớp với điều tôi thực sự muốn, và tôi phải nói rõ lại nhiều lần mới ra đúng ý.</p><p><strong>Bài học:</strong> AI làm việc tái cấu trúc lớn nhanh và ít sai sót hơn tôi tưởng — nhưng vẫn cần người cầm lái ra quyết định cuối cùng, đặc biệt là những quyết định ảnh hưởng tới trải nghiệm người dùng thật.</p>`},
  {title:"Service Worker trên iOS: Bài học đắt giá về \"scope\" tôi ước biết sớm hơn",cat:"Tech",date:"10 Jul 2026",body:`<p>Service Worker là thứ giúp web app hoạt động offline — nhưng nó có một quy tắc ít ai để ý: phạm vi kiểm soát (scope) của nó bị khoá cứng vào vị trí thư mục nơi file service worker được đặt.</p><p>Tôi từng đặt file service worker của GoldTrack ngay tại thư mục gốc của toàn site — với lý do "phòng hờ tương lai". Nhưng sau khi tìm hiểu kỹ, tôi nhận ra service worker đó chưa bao giờ cần điều khiển gì ngoài đúng một sản phẩm — giữ nó ở gốc chỉ khiến phạm vi rộng hơn mức cần thiết, không có lợi ích thực sự.</p><p><strong>Cạm bẫy đã kiểm chứng bằng thực nghiệm:</strong> ép service worker nhận phạm vi rộng hơn thư mục chứa chính nó sẽ bị trình duyệt từ chối thẳng với lỗi bảo mật — và cách duy nhất để nới phạm vi đó cần một HTTP header mà GitHub Pages không cho phép tuỳ chỉnh.</p><p>Sau khi chuyển service worker vào đúng thư mục của sản phẩm, tôi còn phải viết thêm một đoạn code "dọn dẹp" — để trình duyệt của những người đã từng ghé thăm site tự gỡ bỏ service worker cũ, tránh việc họ bị kẹt với hai service worker chồng nhau vĩnh viễn.</p>`},
  {title:"Nửa năm im lặng trên blog: Tôi đã làm gì thay vì viết",cat:"Life",date:"15 Jun 2026",body:`<p>Nhìn lại, tôi nhận ra mình đã không đăng bài mới suốt nửa năm. Không phải vì hết chuyện để viết — mà vì tôi chọn dồn thời gian vào việc build và bảo trì sản phẩm.</p><p>Trong nửa năm đó, tôi đã sửa hàng loạt lỗi trên GoldTrack, làm lại toàn bộ cấu trúc thư mục của site, thêm tính năng mới cho vài sản phẩm khác. Tất cả những việc đó đều "âm thầm" — không có gì để show ra ngoài như một bài blog hào nhoáng.</p><p><strong>Điều tôi nhận ra:</strong> viết blog và ship sản phẩm đôi khi cạnh tranh trực tiếp thời gian với nhau, và tôi đã ưu tiên sai trong một thời gian dài — không phải vì viết không quan trọng, mà vì tôi coi nó là việc "làm khi rảnh", trong khi ship sản phẩm luôn có deadline cụ thể hơn.</p><p>Từ giờ tôi sẽ thử một cách tiếp cận khác: viết ngắn hơn, thường xuyên hơn, ngay trong lúc đang làm — thay vì chờ có một câu chuyện "đủ hay" mới ngồi viết.</p>`},
  {title:"Việc tưởng mất 1 buổi chiều hoá ra ngốn cả tháng",cat:"Work",date:"10 Apr 2026",body:`<p>Tôi từng nghĩ việc dọn lại cấu trúc thư mục cho site cá nhân chỉ mất một buổi chiều rảnh rỗi. Thực tế: việc đó kéo dài gần một tháng, qua nhiều đợt làm việc rời rạc.</p><p><strong>Sai lầm trong ước lượng:</strong> tôi chỉ tính thời gian di chuyển file, mà quên tính thời gian rà soát mọi nơi tham chiếu tới đường dẫn cũ — service worker, CI/CD, tài liệu, thậm chí cả URL đã đăng ký với bên thứ ba. Mỗi lần rà soát lại phát hiện thêm một chỗ bị sót.</p><p>Bài học không mới nhưng lần nào cũng phải học lại: <strong>công việc "dọn dẹp kỹ thuật" luôn có phần ẩn lớn hơn phần nhìn thấy được.</strong> Từ nay, mỗi khi ước lượng một task refactor, tôi sẽ nhân đôi con số ban đầu — và vẫn thường xuyên bị vượt.</p>`},
  {title:"Bắt đầu với AI API: Kinh nghiệm tích hợp OpenAI vào dự án thực tế",cat:"Tech",date:"18 Mar 2026",body:`<p>Trong năm vừa qua, tôi đã tích hợp OpenAI API vào nhiều dự án — từ chatbot hỗ trợ khách hàng đến công cụ phân tích văn bản.</p><p><strong>Prompt engineering quan trọng hơn việc chọn model.</strong> Một prompt tốt với GPT-3.5 thường vượt trội hơn prompt mơ hồ với GPT-4.</p><p>Về chi phí: bắt đầu với gpt-3.5-turbo để prototype, sau đó mới nâng cấp khi cần. Cache kết quả lặp để tiết kiệm.</p><p>Luôn handle lỗi gracefully — người dùng không nên biết khi nào API timeout.</p>`},
  {title:"Làm việc tại FPT Complex: Một năm nhìn lại",cat:"Work",date:"10 Mar 2026",body:`<p>Một năm tại FPT Complex DaNang cho tôi những bài học không thể tìm thấy trong bất kỳ khóa học nào.</p><p>Môi trường rất năng động. Đồng nghiệp giàu kinh nghiệm và sẵn sàng chia sẻ.</p><p><strong>Thách thức lớn nhất: giao tiếp.</strong> Viết code tốt chỉ là một phần — diễn đạt ý tưởng kỹ thuật cho non-developer mới thực sự quan trọng.</p>`},
  {title:"Sống và làm việc ở Đà Nẵng với tư cách một Software Engineer",cat:"Life",date:"02 Mar 2026",body:`<p>Nhiều người hỏi tôi có muốn chuyển lên Hà Nội hay TP.HCM không. Câu trả lời: Đà Nẵng đủ tốt.</p><p>Tech scene đang phát triển nhanh. FPT, Axon Active, KMS Technology... cơ hội không thiếu.</p><p>Quan trọng hơn — chất lượng cuộc sống thực sự tốt. 10 phút ra biển sau giờ làm.</p>`},
  {title:"Docker từ A-Z: Hành trình containerize ứng dụng Node.js đầu tiên",cat:"Tech",date:"15 Mar 2026",body:`<p>Câu cửa miệng "nó chạy trên máy tôi" — chắc ai làm dev cũng nghe hoặc nói câu này ít nhất một lần. Docker ra đời để giải quyết chính xác vấn đề đó.</p><p>Lần đầu dùng Docker, tôi mất cả buổi sáng chỉ để hiểu sự khác nhau giữa <strong>image</strong> và <strong>container</strong>. Image là bản thiết kế, container là ngôi nhà được xây từ bản thiết kế đó — đơn giản vậy thôi.</p><p>Sau khi containerize thành công app Node.js đầu tiên, tôi nhận ra quy trình deploy trở nên nhất quán và đáng tin cậy hơn hẳn. Không còn cảnh "môi trường dev khác production" nữa.</p><p><strong>Tip quan trọng:</strong> Luôn dùng .dockerignore để không copy node_modules vào image. File này quan trọng như .gitignore vậy.</p>`},
  {title:"VietLongCrypto: Tôi đã xây dựng crypto tracker thế nào trong 48 giờ",cat:"Tech",date:"12 Mar 2026",body:`<p>Lúc 2 giờ sáng một ngày cuối tuần, tôi đang xem bảng giá coin và nghĩ: "Tại sao không tự build một cái đẹp hơn?" — và thế là VietLongCrypto ra đời.</p><p>Stack sử dụng: HTML/CSS/JS thuần + CoinGecko API miễn phí. Không cần backend, không cần database. Toàn bộ dữ liệu fetch real-time từ API.</p><p><strong>Khó nhất không phải code</strong> — mà là thiết kế UI sao cho dữ liệu tài chính trông đẹp và dễ đọc. Màu đỏ/xanh cho tăng/giảm, biểu đồ sparkline mini, số liệu được format đúng đơn vị.</p><p>48 giờ sau, sản phẩm deploy lên GitHub Pages. Không hoàn hảo, nhưng là của mình — và đó là điều quan trọng nhất với một side project.</p>`},
  {title:"Code Review: Nghệ thuật cho và nhận feedback trong team",cat:"Work",date:"08 Mar 2026",body:`<p>Code review là một trong những hoạt động tôi học được nhiều nhất — không phải từ việc review code người khác, mà từ việc <strong>bị review</strong>.</p><p>Ban đầu tôi nhận feedback rất cá nhân. "Comment này có nghĩa là code tôi xấu à?" Sai hoàn toàn. Code review là về code, không phải về người viết ra nó.</p><p>Bây giờ khi review, tôi luôn cố gắng: giải thích <em>tại sao</em> chứ không chỉ nói cần thay đổi gì, đặt câu hỏi thay vì ra lệnh, và khen ngợi những đoạn code tốt. Một review tốt nên có cả positive lẫn constructive feedback.</p><p><strong>Rule vàng:</strong> Nếu bạn phải comment cùng một vấn đề nhiều hơn 3 lần trong một PR, đó là dấu hiệu cần có team convention rõ ràng hơn.</p>`},
  {title:"Cân bằng công việc và cuộc sống: Bí quyết của một developer 25 tuổi",cat:"Life",date:"05 Mar 2026",body:`<p>Năm đầu đi làm, tôi code đến 11 giờ đêm gần như mỗi ngày. Nghĩ đó là dedication. Nhìn lại, đó là dấu hiệu tôi không biết quản lý thời gian và không có boundaries rõ ràng.</p><p><strong>Điều thay đổi tư duy của tôi:</strong> Một người mentor nói "Code 8 tiếng với đầu óc tỉnh táo hiệu quả hơn 14 tiếng mà mệt mỏi." Hoàn toàn đúng.</p><p>Hiện tại tôi giữ nguyên tắc: laptop tắt lúc 6:30 tối. Tập gym 3 lần/tuần. Cuối tuần không đọc email công ty. Không phải lười — mà để bộ não có thời gian recover và sáng tạo hơn vào ngày hôm sau.</p><p>Burnout không phải badge of honor. Bền vững mới là chiến lược dài hạn.</p>`},
  {title:"React vs Vue: Góc nhìn của developer đã dùng cả hai trong production",cat:"Tech",date:"28 Feb 2026",body:`<p>Tôi may mắn được dùng cả React lẫn Vue trong môi trường production — và câu trả lời cho "cái nào tốt hơn" là: <strong>tùy.</strong></p><p>React cho tôi sự linh hoạt tuyệt đối. Muốn cấu trúc file thế nào thì thế, muốn dùng state management nào thì dùng. Nhưng linh hoạt đi kèm với trách nhiệm — team cần có convention rõ ràng, không thì mỗi người code theo một style khác nhau.</p><p>Vue ở chiều ngược lại: opinionated hơn, có convention sẵn, developer mới lên tốc độ nhanh hơn. Single File Component (.vue) giúp HTML/CSS/JS của một component nằm gọn trong một file — rất clean.</p><p>Kết luận thực tế: Dự án lớn, team đông, cần scale → React. Dự án vừa, team nhỏ, deadline gấp → Vue.</p>`},
  {title:"Từ sinh viên FPT đến FPT Complex: Con đường không thẳng của tôi",cat:"Work",date:"25 Feb 2026",body:`<p>Nhiều người nghĩ tốt nghiệp FPT rồi vào FPT làm là con đường thẳng. Thực tế của tôi phức tạp hơn nhiều.</p><p>Năm 3, tôi thực tập tại một startup nhỏ — môi trường chaos nhưng học được rất nhiều. Tự làm tất cả: frontend, backend, deploy, thậm chí thiết kế UI. Không có senior dẫn dắt là bất lợi, nhưng cũng buộc mình tự tìm hiểu mọi thứ.</p><p>Apply FPT Complex lần đầu — trượt vòng technical. Mất 3 tháng ôn lại data structures, thuật toán, system design. Lần 2 — đậu.</p><p><strong>Bài học:</strong> Thất bại ở một bước không có nghĩa là con đường đó không dành cho mình. Đôi khi chỉ là cần thêm thời gian chuẩn bị.</p>`},
  {title:"Đà Nẵng sau 8PM: Cuộc sống ngoài màn hình của một dev",cat:"Life",date:"15 Feb 2026",body:`<p>Người ta hay hỏi: "Đà Nẵng nhỏ vậy, không chán à?" Câu trả lời là không — nếu bạn biết tìm.</p><p>Quán cà phê yêu thích sau giờ làm: một góc nhỏ gần sông Hàn, wifi ổn định, cà phê ngon, không ồn. Lý tưởng để đọc sách tech hoặc viết blog mà không bị interrupt.</p><p>6 giờ sáng trước khi vào office: bãi biển Mỹ Khê vắng người, chạy bộ dọc bờ biển trong khoảng 30 phút. Reset đầu óc hoàn toàn cho ngày mới. Đây là thói quen tôi duy trì được 8 tháng và không muốn bỏ.</p><p>Sống ở Đà Nẵng dạy tôi rằng chất lượng cuộc sống không đo bằng số lượng lựa chọn — mà bằng mức độ ý nghĩa của những lựa chọn đó.</p>`},
  {title:"Git workflow tôi dùng khi làm việc một mình và trong team",cat:"Tech",date:"10 Feb 2026",body:`<p>Git không chỉ là công cụ lưu code — đó là công cụ giao tiếp trong team. Commit message của bạn là message gửi đến người review, đến future-you sau 6 tháng đọc lại.</p><p><strong>Conventional Commits</strong> thay đổi cách tôi viết commit message: <code>feat: add user authentication</code>, <code>fix: resolve login timeout issue</code>, <code>docs: update API documentation</code>. Cấu trúc đơn giản nhưng tạo ra lịch sử commit cực kỳ rõ ràng.</p><p>Feature branch workflow: mỗi tính năng là một branch riêng, merge vào main qua Pull Request. Dù làm một mình, tôi vẫn tự review PR của mình trước khi merge — buộc mình nhìn code từ góc độ người khác.</p><p>Squash merge khi PR nhỏ, regular merge khi PR phức tạp cần giữ lại lịch sử commit chi tiết.</p>`},
  {title:"Side projects: Tại sao tôi luôn có ít nhất 1 dự án ngoài giờ làm",cat:"Work",date:"05 Feb 2026",body:`<p>Câu hỏi tôi hay nhận được: "Đi làm cả ngày rồi về còn code nữa sao? Không mệt à?" Câu trả lời: mệt — nhưng đây là loại mệt khác.</p><p>Tại công ty, code phải theo convention, tech stack đã định sẵn, mọi quyết định đều cần approval. Side project là không gian duy nhất tôi có toàn quyền kiểm soát — muốn thử công nghệ mới nào cũng được, muốn thiết kế architecture kiểu gì cũng được.</p><p>VietLongCrypto, trang KOL này — tất cả đều bắt đầu từ câu hỏi "Cái này mình làm được không nhỉ?" Side project là sân chơi để thử nghiệm không có rủi ro.</p><p><strong>Quy tắc của tôi:</strong> Side project không được áp lực hơn công việc chính. Làm khi có hứng, nghỉ khi cần. Đây là hobby, không phải obligation.</p>`},
  {title:"TypeScript: 6 tháng dùng thực tế và những lý do tôi không thể quay lại JS thuần",cat:"Tech",date:"01 Feb 2026",body:`<p>6 tháng trước tôi nghĩ TypeScript là overkill cho project của mình. Bây giờ tôi không thể tưởng tượng làm việc không có nó.</p><p>Điều thay đổi tư duy: lần đầu tiên TypeScript báo lỗi type mismatch ở compile time — lỗi mà nếu dùng JS thuần sẽ chỉ phát hiện lúc runtime, tệ hơn là lúc production. Từ đó tôi hiểu TS không phải thêm code — mà là thêm một lớp bảo vệ.</p><p><strong>Ưu điểm thực tế nhất:</strong> Autocomplete và IntelliSense cực mạnh. Code nhanh hơn vì IDE hiểu được structure của data, không phải nhớ hay đoán.</p><p>Nhược điểm thật sự duy nhất: setup ban đầu mất thêm thời gian. Nhưng đầu tư 1 tiếng setup để tiết kiệm hàng giờ debug sau này — hoàn toàn xứng đáng.</p>`},
  {title:"26 tuổi, 2 năm đi làm: Những điều tôi ước mình biết trước khi tốt nghiệp",cat:"Life",date:"25 Jan 2026",body:`<p>Nếu được nói chuyện với bản thân 3 năm trước, đây là những điều tôi muốn chia sẻ nhất.</p><p><strong>1. Soft skills quan trọng hơn bạn nghĩ.</strong> GPA cao, code giỏi chưa đủ. Khả năng trình bày ý tưởng rõ ràng, làm việc nhóm, xử lý conflict — những thứ này quyết định career trajectory của bạn nhiều hơn bất kỳ technical skill nào.</p><p><strong>2. Networking không phải xin xỏ.</strong> Tôi từng tránh networking vì sợ bị coi là cơ hội chủ nghĩa. Giờ hiểu rằng networking đơn giản là xây dựng mối quan hệ thật sự — giúp đỡ người khác trước, không tính toán.</p><p><strong>3. Đừng so sánh career path.</strong> Bạn bè cùng lứa có người đã làm senior, có người vẫn tìm việc. Mỗi hành trình là khác nhau. Focus vào progress của bản thân, không phải vị trí tương đối so với người khác.</p>`}
];
// localStorage versioning
const LS_VERSION = '1';
function lsGet(key){ try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(e){ return null; } }
function lsSet(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch(e){} }
const extra=(()=>{
  const v=localStorage.getItem('vl_posts_v');
  if(v!==LS_VERSION){ localStorage.removeItem('vl_posts'); localStorage.setItem('vl_posts_v',LS_VERSION); return []; }
  return lsGet('vl_posts')||[];
})();
const ALL=[...BASE,...extra];

// Load saved posts on blog page render
(function loadSavedPosts(){
  const CC={Tech:'var(--blue)',Work:'var(--green)',Life:'var(--pink)',Other:'var(--violet)'};
  extra.forEach((p,i)=>{
    const idx=BASE.length+i;const cat=(p.cat||'other').toLowerCase();const col=CC[p.cat]||'var(--cyan)';
    const card=document.createElement('div');card.className='blog-card';card.style.cursor='none';
    const wc=(p.body||'').replace(/<[^>]+>/g,'').split(/\s+/).length;const rt=Math.max(1,Math.round(wc/200));
    card.innerHTML=`<div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,${col},transparent);"></div><div class="bm"><span class="bcat ${cat}">${p.cat||'Other'}</span><span class="bdate">${p.date}</span><span class="reading-time">${rt} phút</span></div><div class="btitle">${p.title}</div><p class="bexcerpt">${(p.body||'').replace(/<[^>]+>/g,'').substring(0,110)}...</p><div class="bread" style="color:${col};">Đọc tiếp <span>→</span></div>`;
    card.onclick=()=>openModal(idx);
    document.getElementById('blogGrid').appendChild(card);
  });
})();

function openModal(i){
  const p=ALL[i];const CC={Tech:'var(--blue)',Work:'var(--green)',Life:'var(--pink)',Other:'var(--violet)'};
  document.getElementById('modalInner').innerHTML=`<div class="modal-cat" style="color:${CC[p.cat]||'var(--cyan)'}">${p.cat} · ${p.date}</div><h2 class="modal-title">${p.title}</h2><div class="modal-body">${p.body||'<p>'+p.excerpt+'</p>'}</div><button class="share-btn" onclick="shareBlog('${p.title.replace(/'/g,"\'")}')" id="shareBtn">🔗 Chia sẻ bài viết</button>`;
  document.getElementById('modalBg').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeModal(){document.getElementById('modalBg').classList.remove('open');document.body.style.overflow='';}
function closeBg(e){if(e.target===document.getElementById('modalBg'))closeModal();}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

let fOpen=false;
function toggleForm(){fOpen=!fOpen;document.getElementById('writeForm').classList.toggle('open',fOpen);}
function submitPost(){
  const t=document.getElementById('fTitle').value.trim();
  const c=document.getElementById('fContent').value.trim();
  const cat=document.getElementById('fCat').value;
  if(!t||!c){alert('Vui lòng nhập tiêu đề và nội dung.');return;}
  const CL={tech:'Tech',work:'Work',life:'Life',other:'Other'};
  const CC={tech:'var(--blue)',work:'var(--green)',life:'var(--pink)',other:'var(--violet)'};
  const d=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const idx=ALL.length;const body=`<p>${c.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</p>`;
  const post={title:t,body,cat:CL[cat],date:d};ALL.push(post);
  const sv=lsGet('vl_posts')||[];sv.push(post);lsSet('vl_posts',sv);
  const card=document.createElement('div');card.className='blog-card';card.style.cursor='none';
  const wc2=c.split(/\s+/).length;const rt2=Math.max(1,Math.round(wc2/200));
  card.innerHTML=`<div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,${CC[cat]},transparent);"></div><div class="bm"><span class="bcat ${cat}">${CL[cat]}</span><span class="bdate">${d}</span><span class="reading-time">${rt2} phút</span></div><div class="btitle">${t}</div><p class="bexcerpt">${c.substring(0,110)}...</p><div class="bread" style="color:${CC[cat]};">Đọc tiếp <span>→</span></div>`;
  card.onclick=()=>openModal(idx);document.getElementById('blogGrid').appendChild(card);
  document.getElementById('fTitle').value='';document.getElementById('fContent').value='';toggleForm();showToast('Đã đăng bài mới!','success');
}


// ================================================
// TOAST NOTIFICATION SYSTEM
// ================================================
function showToast(msg, type='info', duration=3000) {
  const wrap = document.getElementById('toast-wrap');
  if(!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = {info:'💬', success:'✅', error:'❌', game:'🏆'};
  t.innerHTML = `<span class="toast-icon">${icons[type]||'💬'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ================================================
// ANIMATED COUNT-UP STATS
// ================================================
function runCounters() {
  document.querySelectorAll('[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const iv = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current + suffix;
      if(current >= target) clearInterval(iv);
    }, 40);
  });
}
// Run on home page load
setTimeout(() => { if(document.getElementById('page-home')?.classList.contains('active')) runCounters(); }, 500);

// ================================================
// LEADERBOARD (top 5 per game)
// ================================================
function getLB(game) {
  try { return JSON.parse(localStorage.getItem('lb_' + game) || '[]'); } catch(e) { return []; }
}
function saveLB(game, score, label) {
  const lb = getLB(game);
  const entry = { score, label, date: new Date().toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'}) };
  lb.push(entry);
  lb.sort((a,b) => b.score - a.score);
  lb.splice(5);
  localStorage.setItem('lb_' + game, JSON.stringify(lb));
  if(lb[0].score === score && lb.length >= 1) {
    showToast(`🏆 Kỷ lục mới! ${score} ${label}`, 'game', 4000);
  }
}
function renderLB(game, unit) {
  const lb = getLB(game);
  if(!lb.length) return '';
  const ranks = ['🥇','🥈','🥉','4','5'];
  const rows = lb.slice(0,5).map((e,i) => `
    <div class="lb-row">
      <span class="lb-rank lb-rank-${i+1}">${ranks[i]}</span>
      <span class="lb-score">${e.score} ${unit}</span>
      <span class="lb-date">${e.date}</span>
    </div>`).join('');
  return `<div class="leaderboard">
    <div class="lb-title">🏆 Bảng xếp hạng</div>${rows}
  </div>`;
}

// High score hook - lazy (game engine loads in Script 3)
window.addEventListener('load', function() {
  if(typeof setHighScore === 'function') {
    const _origSetHS = setHighScore;
    window.setHighScore = function(game, val) {
      const result = _origSetHS(game, val);
      const units = {snake:'diem', flappy:'diem', reaction:'ms', '2048':'diem'};
      if(result && typeof saveLB === 'function') saveLB(game, val, units[game]||'');
      return result;
    };
  }
});

// ================================================
// DEEP LINK ROUTING (#games/snake)
// ================================================
function handleDeepLink() {
  const hash = window.location.hash.slice(1);
  if(!hash) { showPage('home'); return; }
  const parts = hash.split('/');
  const page = parts[0];
  const sub = parts[1];
  const validPages = ['home','about','skills','products','blog','games','contact','cv'];
  if(validPages.includes(page)) {
    showPage(page);
    if(page === 'games' && sub) {
      setTimeout(() => {
        const btn = document.querySelector(`[onclick*="loadGame('${sub}')"]`);
        if(btn && typeof loadGame === 'function') { btn.classList.add('highlight-pulse'); loadGame(sub, btn); }
      }, 300);
    }
  } else {
    showPage('home');
  }
}
// Override showPage để cũng update hash
window.addEventListener('hashchange', handleDeepLink);

// ================================================
// CONTACT FORM (Formspree)
// ================================================
async function submitContact() {
  const name = document.getElementById('cf-name')?.value.trim();
  const email = document.getElementById('cf-email')?.value.trim();
  const msg = document.getElementById('cf-msg')?.value.trim();
  const btn = document.getElementById('cf-btn');
  if(!name || !email || !msg) { showToast('Vui lòng điền đầy đủ thông tin', 'error'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email không hợp lệ', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Đang gửi...';
  // Dùng mailto fallback (không cần backend)
  const subject = encodeURIComponent(`[LongLTV.dev] Tin nhắn từ ${name}`);
  const body = encodeURIComponent(`Từ: ${name}\nEmail: ${email}\n\n${msg}`);
  window.open(`mailto:letranvietlong@gmail.com?subject=${subject}&body=${body}`);
  showToast('Đã mở email client! Gửi để hoàn tất.', 'success', 5000);
  document.getElementById('cf-name').value = '';
  document.getElementById('cf-email').value = '';
  document.getElementById('cf-msg').value = '';
  btn.disabled = false; btn.textContent = 'Gửi tin nhắn →';
}

// ================================================
// AVAILABLE STATUS - dynamic từ config
// ================================================
const AVAILABLE = true; // thay false khi không available
(function updateStatus() {
  const dot = document.querySelector('.sdot');
  const statusEl = document.querySelector('.nav-status');
  if(!statusEl) return;
  if(AVAILABLE) {
    statusEl.innerHTML = '<span class="sdot"></span>Available for work';
    statusEl.style.cssText = '';
  } else {
    if(dot) dot.style.background = 'var(--orange)';
    statusEl.innerHTML = '<span class="sdot" style="background:var(--orange)"></span>Open to opportunities';
  }
})();

// ================================================
// INIT: Run deep link on load
// ================================================
document.addEventListener('DOMContentLoaded', () => {
  if(window.location.hash) handleDeepLink();
});



// ===========================================================
// TOAST NOTIFICATION SYSTEM
// ===========================================================
function toast(msg, type='info', duration=3000) {
  const icons = {success:'✅', error:'❌', info:'💡', warn:'⚠️'};
  const container = document.getElementById('toast-container');
  if(!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'💬'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, duration);
}

// ===========================================================
// LEADERBOARD SYSTEM
// ===========================================================
const LB_SIZE = 5;

function getLB(game) {
  return JSON.parse(localStorage.getItem('lb_' + game) || '[]');
}

function addLB(game, score, label='pts') {
  const lb = getLB(game);
  const date = new Date().toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'});
  lb.push({score, date, label});
  lb.sort((a,b) => b.score - a.score);
  const top = lb.slice(0, LB_SIZE);
  localStorage.setItem('lb_' + game, JSON.stringify(top));
  const isTop = top.findIndex(e => e.score === score && e.date === date) < LB_SIZE;
  if(isTop && score > 0) toast(`🏆 Vào top ${LB_SIZE} kỷ lục!`, 'success');
  return top;
}

function renderLB(game, scoreLabel='điểm') {
  const lb = getLB(game);
  if(!lb.length) return '';
  const ranks = ['🥇','🥈','🥉','4','5'];
  const rankCls = ['gold','silver','bronze','',''];
  const rows = lb.map((e,i) => `
    <div class="lb-row">
      <span class="lb-rank ${rankCls[i]}">${ranks[i]}</span>
      <span class="lb-score">${e.score} ${scoreLabel}</span>
      <span class="lb-date">${e.date}</span>
    </div>`).join('');
  return `<div class="leaderboard">
    <div class="leaderboard-title">🏆 Bảng xếp hạng</div>
    ${rows}
  </div>`;
}

// Patch các game để dùng leaderboard

// Hook score vào game over

// Init nếu đang ở home
if(document.getElementById('page-home')?.classList.contains('active')) {
  setTimeout(runCounters, 600);
}

// ===========================================================
// LANGUAGE TOGGLE VI/EN
// ===========================================================
const LANG_EN = {
  'home-badge': 'Software Engineering · Da Nang',
  'home-role': '// Full-Stack Dev & <span>Product Builder</span> since 2000',
  'home-desc': 'Software Engineer at FPT Complex DaNang. Building web & AI products, sharing real-world experience about technology, life and the journey of a developer from Da Nang.',
  'nav-home': 'Home', 'nav-about': 'About', 'nav-skills': 'Skills',
  'nav-products': 'Products', 'nav-blog': 'Blog', 'nav-games': 'Games',
  'nav-contact': 'Contact', 'nav-cv': 'CV',
};
const LANG_VI = {
  'home-badge': 'Software Engineering · Đà Nẵng',
  'home-role': '// Full-Stack Dev & <span>Product Builder</span> since 2000',
  'nav-home': 'Home', 'nav-about': 'About', 'nav-skills': 'Skills',
  'nav-products': 'Products', 'nav-blog': 'Blog', 'nav-games': 'Games',
  'nav-contact': 'Contact', 'nav-cv': 'CV',
};

let currentLang = localStorage.getItem('lang') || 'vi';

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);

  // Update toggle buttons
  const btnVi = document.getElementById('lang-vi');
  const btnEn = document.getElementById('lang-en');
  if(btnVi) { btnVi.classList.toggle('active', lang==='vi'); btnVi.setAttribute('aria-pressed', lang==='vi'); }
  if(btnEn) { btnEn.classList.toggle('active', lang==='en'); btnEn.setAttribute('aria-pressed', lang==='en'); }

  // Translate all elements with data-vi / data-en attributes
  document.querySelectorAll('[data-vi]').forEach(el => {
    el.innerHTML = lang==='en' ? (el.dataset.en||el.dataset.vi) : el.dataset.vi;
  });

  // Translate document title
  document.title = lang==='en'
    ? 'Le Tran Viet Long — Software Engineer'
    : 'Lê Trần Viết Long — Software Engineer';

  toast(lang==='en' ? '🌍 Switched to English' : '🇻🇳 Đã chuyển tiếng Việt', 'info', 2000);
}

// Init lang on load
(function() {
  const saved = localStorage.getItem('lang') || 'vi';
  if(saved !== 'vi') setLang(saved);
})();

// ===========================================================
// DEEP LINK #games/snake
// ===========================================================
(function initDeepLink() {
  const hash = window.location.hash.replace('#','');
  if(!hash) return;
  const parts = hash.split('/');
  if(parts[0] && parts[0] !== 'home') {
    // Wait for all scripts to load before deep linking
    window.addEventListener('load', function() {
      showPage(parts[0]);
      if(parts[0] === 'games' && parts[1]) {
        setTimeout(() => {
          const btn = document.querySelector(`[onclick*="loadGame('${parts[1]}')"]`);
          if(btn) btn.click();
        }, 400);
      }
    });
  }
})();

// ===========================================================
// VISIBILITY CHANGE — pause game loops
// ===========================================================
document.addEventListener('visibilitychange', () => {
  if(document.hidden) {
    if(typeof gameState !== 'undefined') {
      if(gameState.pongRAF)   { cancelAnimationFrame(gameState.pongRAF);   gameState.pongRAF = null;   gameState._pongPaused = true; }
      if(gameState.flappyRAF) { cancelAnimationFrame(gameState.flappyRAF); gameState.flappyRAF = null; gameState._flappyPaused = true; }
      if(gameState.snakeInterval) { clearInterval(gameState.snakeInterval); gameState.snakeInterval = null; gameState._snakePaused = true; }
    }
  } else {
    if(typeof gameState !== 'undefined') {
      if(gameState._pongPaused   && currentGame==='pong')   { gameState._pongPaused=false;   pongLoop(); }
      if(gameState._flappyPaused && currentGame==='flappy') { gameState._flappyPaused=false; flappyLoop(); }
      if(gameState._snakePaused  && currentGame==='snake')  {
        const speeds=[180,120,70]; const lv=getLevel();
        gameState._snakePaused=false;
        gameState.snakeInterval=setInterval(()=>snakeTick(), speeds[lv]);
      }
    }
  }
});

// ===========================================================
// SKILLS RADAR CHART (SVG thuần)
// ===========================================================
function renderRadarChart() {
  const container = document.getElementById('radarChart');
  if(!container) return;
  const skills = [
    {label:'Frontend', value:0.90},
    {label:'Backend',  value:0.80},
    {label:'AI/LLM',   value:0.75},
    {label:'DevOps',   value:0.70},
    {label:'Database', value:0.72},
    {label:'Mobile',   value:0.50},
  ];
  const N=skills.length, R=100, cx=130, cy=120;
  const toXY = (i,r) => {
    const a = (Math.PI*2*i/N) - Math.PI/2;
    return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
  };
  // Grid circles
  let circles = [0.25,0.5,0.75,1].map(t => {
    const pts = skills.map((_,i)=>toXY(i,R*t).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1"/>`;
  }).join('');
  // Axes
  let axes = skills.map((_,i) => {
    const [x,y]=toXY(i,R);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.1)" stroke-width="1"/>`;
  }).join('');
  // Skill polygon
  const pts = skills.map((s,i)=>toXY(i,R*s.value).join(',')).join(' ');
  const poly = `<polygon points="${pts}" fill="rgba(0,245,212,.15)" stroke="var(--cyan)" stroke-width="2" stroke-linejoin="round"/>`;
  // Dots
  const dots = skills.map((s,i) => {
    const [x,y]=toXY(i,R*s.value);
    return `<circle cx="${x}" cy="${y}" r="4" fill="var(--cyan)" stroke="var(--bg)" stroke-width="2"/>`;
  }).join('');
  // Labels
  const labels = skills.map((s,i) => {
    const [x,y]=toXY(i,R*1.22);
    const anchor = x < cx-5 ? 'end' : x > cx+5 ? 'start' : 'middle';
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="var(--mono)" font-size="10" fill="var(--muted)">${s.label} ${Math.round(s.value*100)}%</text>`;
  }).join('');
  container.innerHTML = `<svg width="100%" viewBox="0 0 260 240">
    ${circles}${axes}${poly}${dots}${labels}
  </svg>`;
}

// Patch showPage để render chart khi vào Skills
const _showPageForSkills = window.showPage;
window.showPage = function(id) {
  _showPageForSkills(id);
  if(id === 'skills') setTimeout(renderRadarChart, 100);
};

// ===========================================================
// TOAST vào submit post
// ===========================================================
const _origSubmitPost = submitPost;
window.submitPost = function() {
  _origSubmitPost();
  toast('Bài viết đã được đăng! ✍️', 'success');
};



// ======================================================
//  GAME ENGINE — LongLTV Blog
// ======================================================
let currentGame = null;
let gameState = {};
let scores = {p1:0, draw:0, p2:0};

const GAMES_META = {
  ttt:        {name:'Cờ Ca-rô',           icon:'⭕', modes:['vs-friend','vs-ai'],  levels:['Dễ','Trung bình','Khó']},
  c4:         {name:'Nối Bốn',            icon:'🟡', modes:['vs-friend','vs-ai'],  levels:['Dễ','Trung bình','Khó']},
  cotuong:    {name:'Cờ Tướng',           icon:'🀄', modes:['vs-ai'],              levels:['Dễ','Trung bình','Khó']},
  chess:      {name:'Cờ Vua',             icon:'♟️', modes:['vs-ai'],              levels:['Dễ','Trung bình','Khó']},
  sudoku:     {name:'Ô Số Sudoku',        icon:'🔢', modes:['solo'],               levels:['Dễ','Trung bình','Khó']},
  g2048:      {name:'2048',               icon:'🟦', modes:['solo'],               levels:['Cổ điển']},
  puzzle:     {name:'Xếp Hình Số',        icon:'🧩', modes:['solo'],               levels:['3x3','4x4']},
  blackjack:  {name:'Xì Dách',            icon:'🃏', modes:['solo'],               levels:['Vui','Thường','Cược Cao']},
  rps:        {name:'Oẳn Tù Tì',          icon:'✊', modes:['vs-friend','vs-ai'],  levels:['Dễ','Trung bình','Khó']},
  wordle:     {name:'Đoán Từ',            icon:'💬', modes:['solo'],               levels:['Dễ','Thường','Khó']},
  anagram:    {name:'Xáo Chữ',            icon:'🔀', modes:['solo'],               levels:['Dễ','Trung bình','Khó']},
  quiz:       {name:'Đố Vui IT',          icon:'💡', modes:['solo'],               levels:['Sơ cấp','Trung cấp','Cao cấp']},
  millionaire:{name:'Ai Là Triệu Phú',   icon:'💰', modes:['solo'],               levels:['Dễ','Trung bình','Khó']},
  snake:      {name:'Rắn Săn Mồi',        icon:'🐍', modes:['solo'],               levels:['Chậm','Thường','Nhanh']},
  pong:       {name:'Bóng Bàn',           icon:'🏓', modes:['solo'],               levels:['Dễ','Thường','Khó']},
  flappy:     {name:'Chim Bay',           icon:'🐦', modes:['solo'],               levels:['Dễ','Thường','Khó']},
  simon:      {name:'Nhớ Màu',            icon:'🎵', modes:['solo'],               levels:['Bình thường']},
  memory:     {name:'Lật Bài',            icon:'🧠', modes:['solo'],               levels:['Dễ (4x4)','Vừa (4x5)','Khó (4x6)']},
  minesweeper:{name:'Gỡ Mìn',             icon:'💣', modes:['solo'],               levels:['Mới bắt đầu','Trung bình','Chuyên gia']},
  reaction:   {name:'Phản Xạ',            icon:'⚡', modes:['solo'],               levels:['Bình thường']},
};

function loadGame(id, navEl) {
  currentGame = id;
  scores = {p1:0, draw:0, p2:0};
  document.querySelectorAll('.game-nav-item').forEach(c=>c.classList.remove('active'));
  if(navEl) navEl.classList.add('active');
  // Show arena active panel
  document.getElementById('arenaEmpty').style.display='none';
  const active = document.getElementById('arenaActive');
  active.style.display='flex';
  const meta = GAMES_META[id];
  document.getElementById('arenaIcon').textContent = meta.icon || '🎮';
  document.getElementById('arenaTitle').textContent = meta.name;
  buildArenaControls(id);
  initGame(id);
  // Scroll arena vào tầm nhìn
  setTimeout(() => {
    const arena = document.getElementById('gameArenaWrap');
    if(arena) arena.scrollIntoView({behavior:'smooth', block:'start'});
  }, 80);
}

function buildArenaControls(id) {
  const meta = GAMES_META[id];
  const ctrl = document.getElementById('arenaControls');
  let html = '';
  if (meta.modes.includes('vs-ai')) {
    html += `<span class="ctrl-label">Chế độ:</span>
    <select class="ctrl-select" id="modeSelect" onchange="initGame('${id}')">
      <option value="vs-ai">🤖 vs Máy</option>
      <option value="vs-friend">👥 vs Bạn</option>
    </select>`;
  }
  html += `<span class="ctrl-label">Cấp độ:</span>
  <select class="ctrl-select" id="levelSelect" onchange="initGame('${id}')">
    ${meta.levels.map((l,i)=>`<option value="${i}">${l}</option>`).join('')}
  </select>
  <button class="btn-sm btn-sm-cyan" onclick="initGame('${id}')">🔄 Mới</button>
  <button class="btn-sm btn-sm-red" onclick="closeGame()">✕</button>`;
  ctrl.innerHTML = html;
}

function getMode() { const s=document.getElementById('modeSelect'); return s?s.value:'vs-ai'; }
function getLevel() { const s=document.getElementById('levelSelect'); return s?parseInt(s.value):0; }
function setStatus(msg,color='var(--cyan)'){const s=document.getElementById('gameStatus');s.textContent=msg;s.style.color=color;}

function updateScores(result) {
  if(result==='p1') scores.p1++;
  else if(result==='p2') scores.p2++;
  else scores.draw++;
  const sb=document.getElementById('scoreboard');sb.style.display='flex';
  document.getElementById('p1Score').textContent=scores.p1;
  document.getElementById('p2Score').textContent=scores.p2;
  document.getElementById('drawScore').textContent=scores.draw;
}

function closeGame() {
  if(typeof gameState !== 'undefined') {
    if(gameState.snakeInterval) clearInterval(gameState.snakeInterval);
    if(gameState.reactionTimeout) clearTimeout(gameState.reactionTimeout);
    if(gameState.pongRAF) cancelAnimationFrame(gameState.pongRAF);
    if(gameState.flappyRAF) cancelAnimationFrame(gameState.flappyRAF);
  }
  document.querySelectorAll('.game-nav-item').forEach(c=>c.classList.remove('active'));
  document.getElementById('arenaEmpty').style.display='flex';
  document.getElementById('arenaActive').style.display='none';
  currentGame=null; gameState={};
}

function initGame(id) {
  if(gameState.snakeInterval) clearInterval(gameState.snakeInterval);
  if(gameState.reactionTimeout) clearTimeout(gameState.reactionTimeout);
  gameState={};
  document.getElementById('p1Label').textContent='Bạn';
  document.getElementById('p2Label').textContent=getMode()==='vs-ai'?'Máy':'Người 2';
  const fns={ttt:initTTT,c4:initC4,memory:initMemory,snake:initSnake,
    minesweeper:initMine,wordle:initWordle,puzzle:initPuzzle,
    rps:initRPS,quiz:initQuiz,reaction:initReaction,
    g2048:init2048,millionaire:initMillionaire,
    blackjack:initBlackjack,anagram:initAnagram,sudoku:initSudoku,
    pong:initPong,flappy:initFlappy,simon:initSimon,chess:initChess,cotuong:initCoTuong};
  if(fns[id]) fns[id]();
}

// ======================
// 1. TIC TAC TOE
// ======================
function initTTT() {
  gameState = {board:Array(9).fill(''), turn:'X', over:false};
  document.getElementById('scoreboard').style.display='flex';
  setStatus("Lượt bạn — X");
  document.getElementById('gameBoard').innerHTML = `
    <div class="ttt-grid" id="tttGrid">
      ${Array(9).fill(0).map((_,i)=>`<div class="ttt-cell" id="tc${i}" onclick="tttClick(${i})"></div>`).join('')}
    </div>`;
}
function tttClick(i) {
  const s=gameState; if(s.over||s.board[i]) return;
  playSound('click');
  s.board[i]=s.turn;
  document.getElementById('tc'+i).textContent=s.turn;
  document.getElementById('tc'+i).classList.add(s.turn.toLowerCase(),'taken');
  const w=tttWinner(s.board);
  if(w){tttEnd(w);return;}
  if(s.board.every(c=>c)){setStatus('Hòa! 🤝','var(--orange)');updateScores('draw');s.over=true;return;}
  if(getMode()==='vs-ai'&&s.turn==='X'){s.turn='O';setStatus('Máy đang suy nghĩ...','var(--muted)');setTimeout(()=>tttAI(),400);}
  else{s.turn=s.turn==='X'?'O':'X';setStatus(`Lượt ${s.turn}`);}
}
function tttAI() {
  const s=gameState; if(s.over) return;
  const lv=getLevel();
  let move;
  if(lv===0){const e=s.board.map((v,i)=>v===''?i:-1).filter(i=>i>=0);move=e[Math.floor(Math.random()*e.length)];}
  else if(lv===1){move=tttMinimax(s.board,'O',false,3).idx;}
  else{move=tttMinimax(s.board,'O',false,9).idx;}
  s.board[move]='O';
  document.getElementById('tc'+move).textContent='O';
  document.getElementById('tc'+move).classList.add('o','taken');
  const w=tttWinner(s.board);
  if(w){tttEnd(w);return;}
  if(s.board.every(c=>c)){setStatus('Hòa! 🤝','var(--orange)');updateScores('draw');s.over=true;return;}
  s.turn='X';setStatus('Lượt bạn — X');
}
function tttMinimax(board,player,isMax,depth) {
  const w=tttWinner(board);
  if(w==='X') return {score:-10};
  if(w==='O') return {score:10};
  if(board.every(c=>c)||depth===0) return {score:0};
  const opp=player==='X'?'O':'X';
  let best={score:isMax?-Infinity:Infinity,idx:-1};
  board.forEach((v,i)=>{
    if(v!=='') return;
    board[i]=player;
    const s=tttMinimax(board,opp,!isMax,depth-1);
    board[i]='';
    if(isMax?s.score>best.score:s.score<best.score){best={score:s.score,idx:i};}
  });
  return best;
}
const TTT_LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function tttWinner(b) {
  for(const [a,bb,c] of TTT_LINES) if(b[a]&&b[a]===b[bb]&&b[a]===b[c]) return b[a];
  return null;
}
function tttEnd(w) {
  const s=gameState; s.over=true;
  const line=TTT_LINES.find(([a,b,c])=>s.board[a]&&s.board[a]===s.board[b]&&s.board[a]===s.board[c]);
  line.forEach(i=>document.getElementById('tc'+i).classList.add('win-cell'));
  const winner = w==='X'?'Bạn':'Máy';
  const col = w==='X'?'var(--cyan)':'var(--pink)';
  setStatus(`${winner} thắng! 🎉`, col);
  updateScores(w==='X'?'p1':'p2');
}

// ======================
// 2. CONNECT FOUR
// ======================
function initC4() {
  gameState={board:Array(6).fill(0).map(()=>Array(7).fill(0)),turn:1,over:false};
  document.getElementById('scoreboard').style.display='flex';
  setStatus('Lượt của bạn 🔵');
  renderC4();
}
function renderC4() {
  const b=gameState.board;
  let html='<div class="game-center"><div>';
  // Drop buttons
  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:4px;">';
  for(let c=0;c<7;c++) html+=`<button class="c4-col-btn" onclick="c4Drop(${c})">▼</button>`;
  html+='</div>';
  // Board
  html+='<div class="c4-board">';
  for(let r=0;r<6;r++) for(let c=0;c<7;c++) {
    const cls=b[r][c]===1?'p1':b[r][c]===2?'p2':'';
    html+=`<div class="c4-cell ${cls}" id="c4_${r}_${c}"></div>`;
  }
  html+='</div></div></div>';
  document.getElementById('gameBoard').innerHTML=html;
}
function c4Drop(col) {
  const s=gameState; if(s.over||s.turn!==1) return;
  const row=c4FindRow(s.board,col); if(row<0) return;
  s.board[row][col]=1; renderC4();
  if(c4Check(s.board,row,col,1)){c4End(1);return;}
  if(s.board[0].every((_,c)=>c4FindRow(s.board,c)<0)){setStatus('Hòa!','var(--orange)');updateScores('draw');s.over=true;return;}
  s.turn=2;
  if(getMode()==='vs-ai'){setStatus('Máy đang tính...','var(--muted)');setTimeout(()=>c4AI(),450);}
  else setStatus('Lượt Người 2 🔴');
}
function c4FindRow(b,col){for(let r=5;r>=0;r--) if(!b[r][col]) return r; return -1;}
function c4AI() {
  const s=gameState; if(s.over) return;
  const lv=getLevel(); let col;
  const valid=Array.from({length:7},(_,i)=>i).filter(c=>c4FindRow(s.board,c)>=0);
  if(lv===0){col=valid[Math.floor(Math.random()*valid.length)];}
  else {
    // Check win/block
    col=null;
    for(const p of lv>=2?[2,1]:[2]) {
      for(const c of valid) {
        const r=c4FindRow(s.board,c);
        s.board[r][c]=p;
        if(c4Check(s.board,r,c,p)){s.board[r][c]=0;col=c;break;}
        s.board[r][c]=0;
      }
      if(col!==null) break;
    }
    if(col===null) col=valid.includes(3)?3:valid[Math.floor(Math.random()*valid.length)];
  }
  const row=c4FindRow(s.board,col);
  s.board[row][col]=2; renderC4();
  if(c4Check(s.board,row,col,2)){c4End(2);return;}
  s.turn=1; setStatus('Lượt của bạn 🔵');
}
function c4Check(b,r,c,p) {
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const [dr,dc] of dirs) {
    let cnt=1;
    for(let d=1;d<4;d++){const nr=r+dr*d,nc=c+dc*d;if(nr>=0&&nr<6&&nc>=0&&nc<7&&b[nr][nc]===p)cnt++;else break;}
    for(let d=1;d<4;d++){const nr=r-dr*d,nc=c-dc*d;if(nr>=0&&nr<6&&nc>=0&&nc<7&&b[nr][nc]===p)cnt++;else break;}
    if(cnt>=4) return true;
  }
  return false;
}
function c4End(p) {
  const s=gameState; s.over=true;
  const w=p===1?'Bạn':'Máy'; const col=p===1?'var(--cyan)':'var(--pink)';
  setStatus(`${w} thắng! 🎉`,col); updateScores(p===1?'p1':'p2');
}

// ======================
// 3. MEMORY MATCH
// ======================
function initMemory() {
  const lv=getLevel();
  const configs=[[4,4],[4,5],[4,6]];const [cols,rows]=configs[lv];
  const emojis='🎮🎯🎲🎸🎺🎻🎹🎼🎤🎧🎨🏆🎃🦄🐉🔮🌈⚡🌟💫'.split('');
  const total=cols*rows; const pairs=total/2;
  const cards=[...emojis.slice(0,pairs),...emojis.slice(0,pairs)].sort(()=>Math.random()-.5);
  gameState={cards,flipped:[],matched:[],moves:0,lock:false};
  document.getElementById('scoreboard').style.display='none';
  setStatus('Lật 2 thẻ giống nhau để ghép đôi 🧠');
  document.getElementById('gameBoard').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;max-width:420px;margin:0 auto 12px;">
      <span style="font-family:var(--mono);font-size:.72rem;color:var(--muted);">Số bước: <span id="memMoves" style="color:var(--cyan);">0</span></span>
      <span style="font-family:var(--mono);font-size:.72rem;color:var(--muted);">Cặp: <span id="memPairs" style="color:var(--green);">0</span>/${pairs}</span>
    </div>
    <div class="memory-grid" style="grid-template-columns:repeat(${cols},1fr);" id="memGrid">
      ${cards.map((_,i)=>`<div class="mem-card" id="mc${i}" onclick="memFlip(${i})">❓</div>`).join('')}
    </div>`;
}
function memFlip(i) {
  const s=gameState;
  if(s.lock||s.flipped.includes(i)||s.matched.includes(i)) return;
  s.flipped.push(i);
  document.getElementById('mc'+i).textContent=s.cards[i];
  document.getElementById('mc'+i).classList.add('flipped');
  if(s.flipped.length===2) {
    s.moves++;document.getElementById('memMoves').textContent=s.moves;
    s.lock=true;
    const [a,b]=s.flipped;
    if(s.cards[a]===s.cards[b]) {
      s.matched.push(a,b);
      document.getElementById('mc'+a).classList.add('matched');
      document.getElementById('mc'+b).classList.add('matched');
      s.flipped=[];s.lock=false;
      document.getElementById('memPairs').textContent=s.matched.length/2;
      if(s.matched.length===s.cards.length){setStatus(`Hoàn thành! 🎉 ${s.moves} lượt`,'var(--green)');}
    } else {
      setTimeout(()=>{
        [a,b].forEach(idx=>{
          document.getElementById('mc'+idx).textContent='❓';
          document.getElementById('mc'+idx).classList.remove('flipped');
        });
        s.flipped=[];s.lock=false;
      },900);
    }
  }
}

// ======================
// 4. SNAKE
// ======================
function initSnake() {
  const speeds=[180,120,70]; const lv=getLevel();
  const SZ=20,W=15,H=15;
  document.getElementById('scoreboard').style.display='none';
  setStatus('Dùng phím mũi tên hoặc WASD để điều khiển 🐍');
  const snakeLB = renderLB('snake','điểm');
  document.getElementById('gameBoard').innerHTML=snakeLB+`
    <div style="text-align:center;margin-bottom:8px;font-family:var(--mono);font-size:.72rem;color:var(--muted);">
      Điểm: <span id="snakeScore" style="color:var(--cyan);font-weight:700;">0</span>
    </div>
    <canvas id="snake-canvas" width="${W*SZ}" height="${H*SZ}"></canvas>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:8px;flex-wrap:wrap;">
      <button class="btn-sm btn-sm-outline" style="min-width:48px" onclick="snakeDirBtn(0,-1)">⬆</button>
    </div>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:2px;">
      <button class="btn-sm btn-sm-outline" style="min-width:48px" onclick="snakeDirBtn(-1,0)">⬅</button>
      <button class="btn-sm btn-sm-outline" style="min-width:48px" onclick="snakeDirBtn(0,1)">⬇</button>
      <button class="btn-sm btn-sm-outline" style="min-width:48px" onclick="snakeDirBtn(1,0)">➡</button>
    </div>`;
  document.removeEventListener('keydown',snakeKey);
  document.addEventListener('keydown',snakeKey);
  const _speedLv=lv;
  showCountdown(()=>{
    if(typeof gameState==='undefined') return;
    gameState={snake:[{x:7,y:7}],dir:{x:1,y:0},food:{x:Math.floor(Math.random()*W),y:Math.floor(Math.random()*H)},score:0,over:false,SZ,W,H};
    snakeDraw();
    gameState.snakeInterval=setInterval(()=>snakeTick(),speeds[lv]);
  });
}
function snakeKey(e) {
  if(!gameState||!gameState.snake) return;
  const map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
    w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0},W:{x:0,y:-1},S:{x:0,y:1},A:{x:-1,y:0},D:{x:1,y:0}};
  if(map[e.key]){e.preventDefault();snakeDir(map[e.key].x,map[e.key].y);}
}
function snakeDirBtn(x,y){snakeDir(x,y);}
function snakeDir(x,y) {
  const d=gameState.dir;
  if(d.x===x&&d.y===y) return;
  if(d.x===-x&&d.y===-y) return;
  gameState.nextDir={x,y};
}
function snakeTick() {
  const s=gameState; if(s.over) return;
  if(s.nextDir){s.dir=s.nextDir;s.nextDir=null;}
  const head={x:s.snake[0].x+s.dir.x,y:s.snake[0].y+s.dir.y};
  if(head.x<0||head.x>=s.W||head.y<0||head.y>=s.H||s.snake.some(p=>p.x===head.x&&p.y===head.y)){
    s.over=true;clearInterval(s.snakeInterval);
    const isNewS=setHighScore('snake',s.score);if(isNewS)showToast(`Kỷ lục Snake: ${s.score} điểm!`,'game');setStatus(`Thua rồi! Điểm: ${s.score}${isNewS?' 🏆 Kỷ lục!':' 💀'}`,'var(--pink)');return;
  }
  s.snake.unshift(head);
  if(head.x===s.food.x&&head.y===s.food.y){
    s.score+=10;document.getElementById('snakeScore').textContent=s.score;playSound('eat');
    s.food={x:Math.floor(Math.random()*s.W),y:Math.floor(Math.random()*s.H)};
  } else s.snake.pop();
  snakeDraw();
}
function snakeDraw() {
  const s=gameState,cv=document.getElementById('snake-canvas');
  if(!cv) return;
  const ctx=cv.getContext('2d'),{SZ,W,H}=s;
  ctx.fillStyle='#06080f';ctx.fillRect(0,0,W*SZ,H*SZ);
  // Grid
  ctx.strokeStyle='rgba(0,245,212,.04)';ctx.lineWidth=1;
  for(let i=0;i<W;i++){ctx.beginPath();ctx.moveTo(i*SZ,0);ctx.lineTo(i*SZ,H*SZ);ctx.stroke();}
  for(let i=0;i<H;i++){ctx.beginPath();ctx.moveTo(0,i*SZ);ctx.lineTo(W*SZ,i*SZ);ctx.stroke();}
  // Food
  ctx.fillStyle='#f72585';ctx.shadowColor='#f72585';ctx.shadowBlur=12;
  ctx.beginPath();ctx.arc(s.food.x*SZ+SZ/2,s.food.y*SZ+SZ/2,SZ/2-2,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  // Snake
  s.snake.forEach((p,i)=>{
    ctx.fillStyle=i===0?'#00f5d4':`rgba(0,245,212,${Math.max(.3,1-i*0.05)})`;
    if(i===0){ctx.shadowColor='#00f5d4';ctx.shadowBlur=10;}else ctx.shadowBlur=0;
    ctx.fillRect(p.x*SZ+1,p.y*SZ+1,SZ-2,SZ-2);
  });ctx.shadowBlur=0;
}

// ======================
// 5. MINESWEEPER
// ======================
function initMine() {
  const cfgs=[[9,9,10],[13,13,25],[16,16,40]];
  const [R,C,M]=cfgs[getLevel()];
  const board=Array(R).fill(0).map(()=>Array(C).fill(0));
  const flags=Array(R).fill(0).map(()=>Array(C).fill(false));
  const revealed=Array(R).fill(0).map(()=>Array(C).fill(false));
  gameState={R,C,M,board,flags,revealed,started:false,over:false,first:true};
  document.getElementById('scoreboard').style.display='none';
  setStatus(`💣 ${M} quả mìn — Nhấp trái để mở, nhấp phải cắm cờ`);
  renderMine();
}
function minePlace(fr,fc) {
  const s=gameState;
  let placed=0,mines=new Set();
  while(placed<s.M){const r=Math.floor(Math.random()*s.R),c=Math.floor(Math.random()*s.C);
    const k=`${r},${c}`;if(!mines.has(k)&&!(r===fr&&c===fc)){mines.add(k);s.board[r][c]=-1;placed++;}}
  for(let r=0;r<s.R;r++) for(let c=0;c<s.C;c++) {
    if(s.board[r][c]===-1) continue;
    let cnt=0;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<s.R&&nc>=0&&nc<s.C&&s.board[nr][nc]===-1)cnt++;}
    s.board[r][c]=cnt;
  }
}
function mineClick(r,c) {
  const s=gameState; if(s.over||s.flags[r][c]||s.revealed[r][c]) return;
  if(s.first){minePlace(r,c);s.first=false;}
  if(s.board[r][c]===-1){
    s.revealed[r][c]=true;s.over=true;
    for(let i=0;i<s.R;i++) for(let j=0;j<s.C;j++) if(s.board[i][j]===-1) s.revealed[i][j]=true;
    renderMine();setStatus('💥 Bạn đã chạm mìn! Thua rồi','var(--pink)');return;
  }
  mineReveal(r,c);renderMine();
  const safe=s.R*s.C-s.M;
  const rev=s.revealed.flat().filter(Boolean).length;
  if(rev>=safe){s.over=true;setStatus('🎉 Thắng rồi! Tất cả ô an toàn đã mở!','var(--green)');}
}
function mineReveal(r,c) {
  const s=gameState;
  if(r<0||r>=s.R||c<0||c>=s.C||s.revealed[r][c]||s.flags[r][c]) return;
  s.revealed[r][c]=true;
  if(s.board[r][c]===0) for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) mineReveal(r+dr,c+dc);
}
function mineFlag(e,r,c){e.preventDefault();const s=gameState;if(s.over||s.revealed[r][c])return;s.flags[r][c]=!s.flags[r][c];renderMine();}
const MINE_COLORS=['','#4cc9f0','#06d6a0','#f72585','#a855f7','#ff6b35','#00f5d4','#f0f2f8','#8a95b5'];
function renderMine() {
  const s=gameState;
  let html=`<div class="mine-grid" style="grid-template-columns:repeat(${s.C},1fr);">`;
  for(let r=0;r<s.R;r++) for(let c=0;c<s.C;c++) {
    let cls='mine-cell',content='',style='';
    if(s.revealed[r][c]){
      cls+=' revealed';
      if(s.board[r][c]===-1){cls+=' boom';content='💣';}
      else if(s.board[r][c]>0){content=s.board[r][c];style=`color:${MINE_COLORS[s.board[r][c]]};`;}
    } else if(s.flags[r][c]){cls+=' flagged';content='🚩';}
    html+=`<div class="${cls}" style="${style}" onclick="mineClick(${r},${c})" oncontextmenu="mineFlag(event,${r},${c})">${content}</div>`;
  }
  html+='</div>';
  document.getElementById('gameBoard').innerHTML=html;
}

// ======================
// 6. WORDLE
// ======================
const WORDS5 = ['REACT','CLOUD','LINUX','MYSQL','SWIFT','SCALA','REDUX','PROXY','NEXUS','ALGOS','BYTES','CACHE','DEBUG','FLASK','GRAPH','HTTPS','INDEX','REGEX','STACK','TOKEN','ARRAY','BLOCK','CLASS','DELTA','EVENT','FIBER','HOOKS','INPUT','QUERY','LOCAL','MACRO','NODES','OAUTH','PATCH','QUEUE','ROUTE','STATE','TABLE','UNION','WATCH','ABORT','ALIAS','ASYNC','AUDIT','BASIC','BUILD','CHILD','CLEAN','CLONE','CLOSE','CONST','CRYPT','CYCLE','DEFER','EMPTY','ENTRY','ERROR','EXACT','FETCH','FIELD','FINAL','FLOAT','FORCE','FRAME','GROUP','GUARD','GUESS','GUIDE','HOIST','IMAGE','INNER','LABEL','LAYER','LIMIT','LOGIN','LOOPS','MERGE','MODAL','MOUNT','MUTEX','NAMED','NONCE','NORTH','OFFER','ORDER','OUTER','OWNER','PARSE','PIVOT','PLAIN','PRINT','PROTO','PROXY','QUERY','RATIO','REALM','RETRY','SCOPE','SERVE','SETUP','SHARE','SHORT','SINCE','SLICE','STORE','STYLE','SUPER','THEME','THROW','TIMER','TITLE','TRACK','TRANS','TUPLE','TYPED','UNDEF','UNION','USAGE','VALID','VALUE','VAULT','WRITE','XARGS','YIELD'];
function initWordle() {
  const word=WORDS5[Math.floor(Math.random()*WORDS5.length)];
  gameState={word,guesses:[],currentGuess:'',over:false,maxGuess:6};
  document.getElementById('scoreboard').style.display='none';
  setStatus('Đoán từ IT gồm 5 chữ cái 📝');
  renderWordle();
  document.removeEventListener('keydown',wordleKey);
  document.addEventListener('keydown',wordleKey);
}
function wordleKey(e){
  if(!gameState||!gameState.word) return;
  if(gameState.over) return;
  if(e.key==='Enter'){wordleSubmit();}
  else if(e.key==='Backspace'){gameState.currentGuess=gameState.currentGuess.slice(0,-1);renderWordle();}
  else if(/^[a-zA-Z]$/.test(e.key)&&gameState.currentGuess.length<5){
    gameState.currentGuess+=e.key.toUpperCase();renderWordle();
  }
}
function wordlePress(k){
  if(gameState.over) return;
  if(k==='⌫'){gameState.currentGuess=gameState.currentGuess.slice(0,-1);}
  else if(k==='↵'){wordleSubmit();}
  else if(gameState.currentGuess.length<5){gameState.currentGuess+=k;}
  renderWordle();
}
function wordleSubmit(){
  const s=gameState;
  if(s.currentGuess.length!==5){setStatus('Cần đủ 5 chữ cái!','var(--orange)');return;}
  s.guesses.push(s.currentGuess);
  if(s.currentGuess===s.word){s.over=true;setStatus('🎉 Xuất sắc!','var(--green)');updateScores('p1');}
  else if(s.guesses.length>=s.maxGuess){s.over=true;setStatus(`Từ đúng là: ${s.word}`,'var(--pink)');updateScores('p2');}
  s.currentGuess='';renderWordle();
}
function wordleEval(guess,word){
  const res=Array(5).fill('absent');const wArr=[...word],gArr=[...guess];
  gArr.forEach((c,i)=>{if(c===wArr[i]){res[i]='correct';wArr[i]=null;gArr[i]=null;}});
  gArr.forEach((c,i)=>{if(!c) return;const j=wArr.indexOf(c);if(j>=0){res[i]='present';wArr[j]=null;}});
  return res;
}
function renderWordle(){
  const s=gameState;const rows=[];
  for(let i=0;i<s.maxGuess;i++){
    const guess=i<s.guesses.length?s.guesses[i]:'';
    const ev=i<s.guesses.length?wordleEval(guess,s.word):null;
    const cells=Array(5).fill(0).map((_,j)=>{
      const ch= i===s.guesses.length&&j<s.currentGuess.length?s.currentGuess[j]:(guess[j]||'');
      const cls=ev?ev[j]:'';
      return `<div class="wordle-cell ${cls}">${ch}</div>`;
    }).join('');
    rows.push(cells);
  }
  // Keyboard
  const keys=[['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['↵','Z','X','C','V','B','N','M','⌫']];
  const kmap={};s.guesses.forEach(g=>{const ev=wordleEval(g,s.word);[...g].forEach((c,i)=>{
    if(!kmap[c]||kmap[c]==='absent'||(kmap[c]==='present'&&ev[i]==='correct')) kmap[c]=ev[i];
  });});
  const kb=keys.map(row=>`<div class="wordle-row">${row.map(k=>`<button class="wkey ${kmap[k]||''}" onclick="wordlePress('${k}')">${k}</button>`).join('')}</div>`).join('');
  document.getElementById('gameBoard').innerHTML=`
    <div class="wordle-grid">${rows.join('')}</div>
    <div class="wordle-keyboard">${kb}</div>`;
}

// ======================
// 7. SLIDING PUZZLE
// ======================
function initPuzzle(){
  const n=getLevel()===0?3:4;
  let tiles=[...Array(n*n).keys()].map(i=>i);
  // Shuffle hợp lệ
  do{for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}}
  while(!puzzleSolvable(tiles,n)||puzzleSolved(tiles));
  gameState={tiles,n,moves:0};
  document.getElementById('scoreboard').style.display='none';
  setStatus(`Sắp xếp ô số từ 1 đến ${n*n-1} 🔢`);
  renderPuzzle();
}
function puzzleSolvable(t,n){
  let inv=0;const flat=t.filter(x=>x!==0);
  for(let i=0;i<flat.length;i++) for(let j=i+1;j<flat.length;j++) if(flat[i]>flat[j]) inv++;
  if(n%2!==0) return inv%2===0;
  const row=Math.floor(t.indexOf(0)/n);
  return (inv+row)%2!==0;
}
function puzzleSolved(t){return t.every((v,i)=>v===(i===t.length-1?0:i+1));}
function puzzleClick(i){
  const s=gameState,{tiles,n}=s;
  const blank=tiles.indexOf(0);
  const [br,bc]=[Math.floor(blank/n),blank%n],[tr,tc]=[Math.floor(i/n),i%n];
  if(Math.abs(br-tr)+Math.abs(bc-tc)!==1) return;
  [tiles[blank],tiles[i]]=[tiles[i],tiles[blank]];
  s.moves++;renderPuzzle();
  if(puzzleSolved(tiles)){setStatus(`🎉 Hoàn thành! ${s.moves} lượt`,'var(--green)');}
}
function renderPuzzle(){
  const {tiles,n,moves}=gameState;
  document.getElementById('gameBoard').innerHTML=`
    <div style="text-align:center;margin-bottom:10px;font-family:var(--mono);font-size:.72rem;color:var(--muted);">Số bước: <span style="color:var(--cyan)">${moves}</span></div>
    <div class="puzzle-grid" style="grid-template-columns:repeat(${n},1fr);max-width:${n*70}px;">
      ${tiles.map((v,i)=>`<div class="puzzle-tile ${v?'num':'empty'}" onclick="puzzleClick(${i})" style="font-size:${n===3?'1.4rem':'1rem'}">${v||''}</div>`).join('')}
    </div>`;
}

// ======================
// 8. ROCK PAPER SCISSORS
// ======================
const RPS_ITEMS=['✊','✋','✌️'];const RPS_NAMES=['Đá','Giấy','Kéo'];
const RPS_BEATS={0:2,1:0,2:1};
function initRPS(){
  gameState={history:[],round:0};
  document.getElementById('scoreboard').style.display='flex';
  document.getElementById('p1Label').textContent='Bạn';
  document.getElementById('p2Label').textContent=getMode()==='vs-ai'?'Máy':'Người 2';
  setStatus('Chọn: ✊ ✋ ✌️');
  renderRPS();
}
function rpsPlay(choice){
  const s=gameState,mode=getMode(),lv=getLevel();
  let ai;
  if(mode==='vs-friend'){
    if(!s.waitingP2){s.p1Choice=choice;s.waitingP2=true;setStatus('Người 2 chọn đi!');return;}
    ai=choice; choice=s.p1Choice; s.waitingP2=false;
  } else {
    // AI strategy by level
    if(lv===0){ai=Math.floor(Math.random()*3);}
    else if(lv===1){
      // Simple: thỉnh thoảng predict
      const hist=s.history.map(h=>h.p1);
      const counts=[0,0,0];hist.forEach(x=>counts[x]++);
      const likely=counts.indexOf(Math.max(...counts));
      ai=Math.random()<0.5?RPS_BEATS[likely]:Math.floor(Math.random()*3);
    } else {
      // Hard: luôn predict dựa vào lịch sử
      const last3=s.history.slice(-3).map(h=>h.p1);
      const counts=[0,0,0];last3.forEach(x=>counts[x]++);
      const likely=counts.indexOf(Math.max(...counts));
      ai=RPS_BEATS[likely];
    }
  }
  s.round++;
  let result,msg,col;
  if(choice===ai){result='draw';msg='Hòa! 🤝';col='var(--orange)';}
  else if(RPS_BEATS[choice]===ai){result='p1';msg='Bạn thắng! 🎉';col='var(--cyan)';}
  else{result='p2';msg='Bạn thua! 💀';col='var(--pink)';}
  s.history.push({p1:choice,p2:ai,result});
  setStatus(msg,col);updateScores(result);renderRPS(choice,ai,msg);
}
function renderRPS(p1,p2,msg){
  const s=gameState;
  let mid='';
  if(p1!==undefined){
    mid=`<div class="rps-result">
      <div class="rps-pick"><span class="rps-pick-icon">${RPS_ITEMS[p1]}</span><span class="rps-pick-label">Bạn</span></div>
      <span class="rps-vs">VS</span>
      <div class="rps-pick"><span class="rps-pick-icon">${RPS_ITEMS[p2]}</span><span class="rps-pick-label">${getMode()==='vs-ai'?'Máy':'Người 2'}</span></div>
    </div>`;
  }
  document.getElementById('gameBoard').innerHTML=`
    ${mid}
    <div class="rps-options">
      ${RPS_ITEMS.map((ic,i)=>`<button class="rps-btn" onclick="rpsPlay(${i})" title="${RPS_NAMES[i]}">${ic}</button>`).join('')}
    </div>
    <div style="text-align:center;font-family:var(--mono);font-size:.68rem;color:var(--muted);">Vòng ${s.round} — Nhấp để chơi tiếp</div>`;
}

// ======================
// 9. TECH QUIZ
// ======================
const QUIZ_BANK = [
  {q:"HTML là viết tắt của?",a:["HyperText Markup Language","High Tech Modern Language","Hyper Transfer Markup Language","Home Tool Markup Language"],c:0},
  {q:"CSS Flexbox: thuộc tính nào căn giữa theo trục chính?",a:["align-items","justify-content","flex-wrap","flex-direction"],c:1},
  {q:"Trong JavaScript, typeof null trả về gì?",a:["null","undefined","object","boolean"],c:2},
  {q:"HTTP status code 404 nghĩa là?",a:["Server Error","Not Found","Unauthorized","Forbidden"],c:1},
  {q:"Git command để tạo branch mới và chuyển sang?",a:["git branch new","git checkout -b new","git switch new","git create new"],c:1},
  {q:"RESTful API sử dụng HTTP method nào để cập nhật một phần resource?",a:["PUT","POST","PATCH","UPDATE"],c:2},
  {q:"SQL: Câu lệnh nào dùng để lọc nhóm sau GROUP BY?",a:["WHERE","FILTER","HAVING","SELECT"],c:2},
  {q:"Big O notation O(log n) tương ứng với thuật toán nào?",a:["Linear Search","Binary Search","Bubble Sort","Quick Sort"],c:1},
  {q:"Docker là công nghệ gì?",a:["Virtual Machine","Container Runtime","Cloud Service","CI/CD Tool"],c:1},
  {q:"React Hook nào để quản lý side effects?",a:["useState","useContext","useEffect","useReducer"],c:2},
  {q:"JSON là viết tắt của?",a:["Java Standard Object Notation","JavaScript Object Notation","Java Syntax Object Node","JavaScript Open Notation"],c:1},
  {q:"Package manager mặc định của Node.js là?",a:["yarn","pip","npm","brew"],c:2},
  {q:"SOLID: 'S' viết tắt của nguyên tắc?",a:["Scalability","Single Responsibility","Separation of Concerns","Static Typing"],c:1},
  {q:"Trong Python, list comprehension nào đúng cú pháp?",a:["[x*2 for x in range(10)]","(x*2 for x in range(10))","[x*2 | x in range(10)]","[for x in range(10): x*2]"],c:0},
  {q:"Protocol mặc định của HTTPS chạy trên port?",a:["80","8080","443","22"],c:2},
  {q:"WebSocket khác HTTP ở điểm?",a:["Nhanh hơn","Kết nối 2 chiều liên tục","Bảo mật hơn","Chỉ dùng cho mobile"],c:1},
  {q:"Time complexity của QuickSort trường hợp trung bình?",a:["O(n)","O(n log n)","O(n²)","O(log n)"],c:1},
  {q:"Vue.js directive nào dùng để binding 2 chiều?",a:["v-bind","v-model","v-on","v-if"],c:1},
  {q:"Trong TypeScript, interface và type khác nhau ở điểm quan trọng nào?",a:["interface có thể extends, type thì không","type có thể merge declarations","interface có thể merge declarations","Không có sự khác biệt"],c:2},
  {q:"CI/CD viết tắt của?",a:["Code Integration / Code Deployment","Continuous Integration / Continuous Deployment","Control Interface / Control Design","Compile Integrate / Compile Deploy"],c:1},
];
const QUIZ_COUNTS=[5,10,15];
function initQuiz(){
  const pool=[...QUIZ_BANK].sort(()=>Math.random()-.5).slice(0,QUIZ_COUNTS[getLevel()]);
  gameState={pool,idx:0,score:0,answered:false};
  document.getElementById('scoreboard').style.display='none';
  setStatus(`Câu đố IT — ${pool.length} câu hỏi 🧩`);
  renderQuiz();
}
function quizAnswer(i){
  const s=gameState; if(s.answered) return;
  s.answered=true;
  const q=s.pool[s.idx];
  const opts=document.querySelectorAll('.quiz-opt');
  opts[q.c].classList.add('correct');
  if(i!==q.c){opts[i].classList.add('wrong');}
  else{s.score++;}
  setTimeout(()=>{
    s.idx++;s.answered=false;
    if(s.idx>=s.pool.length){
      setStatus(`Hoàn thành! ${s.score}/${s.pool.length} câu đúng 🎓`,s.score>=s.pool.length*.7?'var(--green)':'var(--orange)');
      document.getElementById('gameBoard').innerHTML=`
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:3rem;margin-bottom:12px;">${s.score>=s.pool.length*.7?'🏆':'📚'}</div>
          <div style="font-family:var(--mono);font-size:1.2rem;color:var(--text);margin-bottom:8px;">${s.score} / ${s.pool.length}</div>
          <div style="font-size:.85rem;color:var(--muted);">${s.score>=s.pool.length*.7?'Xuất sắc! 🎉':'Cần ôn thêm 💪'}</div>
        </div>`;
    } else renderQuiz();
  },1200);
}
function renderQuiz(){
  const s=gameState,q=s.pool[s.idx],pct=((s.idx)/s.pool.length*100).toFixed(0);
  document.getElementById('gameBoard').innerHTML=`
    <div style="max-width:560px;margin:0 auto;">
      <div class="quiz-progress"><div class="quiz-progress-bar" style="width:${pct}%"></div></div>
      <div style="font-family:var(--mono);font-size:.65rem;color:var(--muted);text-align:right;margin-bottom:10px;">${s.idx+1}/${s.pool.length} · ✅ ${s.score}</div>
      <div class="quiz-question">${q.q}</div>
      <div class="quiz-options">${q.a.map((a,i)=>`<button class="quiz-opt" onclick="quizAnswer(${i})">${a}</button>`).join('')}</div>
    </div>`;
}

// ======================
// 10. REACTION TEST
// ======================
function initReaction(){
  gameState={state:'idle',times:[],best:null,timer:null};
  document.getElementById('scoreboard').style.display='none';
  setStatus('Nhấp vào ô để bắt đầu — rồi nhấp lại khi ô chuyển xanh! ⚡');
  renderReaction('idle');
}
function renderReaction(state,ms){
  const s=gameState;
  const msgs={
    idle:'👆 Nhấp vào đây để bắt đầu',
    wait:'⏳ Chờ đã...',
    go:'⚡ NHẤP NGAY!',
    result:`✅ ${ms}ms — ${ms<200?'Siêu nhanh! 🚀':ms<300?'Nhanh! ⚡':ms<500?'Tốt! 👍':'Chậm rồi 😅'}`
  };
  const zone=`<div class="reaction-zone ${state==='idle'?'result':state}" id="reactionZone" onclick="reactionClick()" style="${state==='idle'?'border-color:rgba(0,245,212,.3);color:var(--cyan);background:rgba(0,245,212,.04);':''}">${msgs[state]||msgs.idle}</div>`;
  const hist=s.times.length?`<div class="reaction-history">${s.times.slice(-8).map(t=>`<span class="reaction-badge">${t}ms</span>`).join('')}</div>`:'';
  const best=s.best?`<div style="text-align:center;margin-top:8px;font-family:var(--mono);font-size:.72rem;color:var(--green);">🏅 Kỷ lục: ${s.best}ms</div>`:'';
  document.getElementById('gameBoard').innerHTML=zone+hist+best;
}
function reactionClick(){
  const s=gameState;
  if(s.state==='idle'||s.state==='result'){
    // Bắt đầu vòng mới
    if(s.timer) clearTimeout(s.timer);
    s.state='wait';
    renderReaction('wait');
    const delay=1000+Math.random()*3000;
    s.timer=setTimeout(()=>{
      if(s.state!=='wait') return; // Guard: đã bị cancel
      s.state='go';
      s.startTime=Date.now();
      renderReaction('go');
    }, delay);
  } else if(s.state==='wait'){
    // Nhấp sớm quá
    clearTimeout(s.timer);
    s.timer=null;
    s.state='idle';
    setStatus('⛔ Nhấp sớm quá! Nhấp lại để thử tiếp','var(--pink)');
    renderReaction('idle');
  } else if(s.state==='go'){
    // Đo thời gian
    const ms=Date.now()-s.startTime;
    s.times.push(ms);
    if(!s.best||ms<s.best){s.best=ms;setHighScore('reaction',Math.round(1000/ms*100));}
    s.state='result';
    setStatus(`⚡ ${ms}ms — Nhấp lại để thử tiếp`,ms<300?'var(--green)':ms<500?'var(--cyan)':'var(--orange)');
    renderReaction('result',ms);
  }
}

// ==================================
// 11. 2048
// ==================================
function init2048() {
  gameState = {board: Array(4).fill(0).map(()=>Array(4).fill(0)), score:0, best:parseInt(localStorage.getItem('2048best')||'0'), over:false, won:false};
  document.getElementById('scoreboard').style.display='none';
  setStatus('Dùng phím mũi tên hoặc vuốt để ghép ô — mục tiêu đạt 2048! 🟦');
  add2048Tile(); add2048Tile();
  render2048();
  document.removeEventListener('keydown', key2048);
  document.addEventListener('keydown', key2048);
}

function key2048(e) {
  if(!currentGame || currentGame !== 'g2048') return;
  const map = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
  if(map[e.key]) { e.preventDefault(); move2048(map[e.key]); }
}

function add2048Tile() {
  const empty=[];
  gameState.board.forEach((row,r)=>row.forEach((v,c)=>{if(!v)empty.push([r,c]);}));
  if(!empty.length) return;
  const [r,c]=empty[Math.floor(Math.random()*empty.length)];
  gameState.board[r][c]=Math.random()<0.9?2:4;
}

function move2048(dir) {
  const s=gameState; if(s.over) return;
  const prev=JSON.stringify(s.board);
  const b=s.board;

  function slide(row) {
    let arr=row.filter(v=>v);
    for(let i=0;i<arr.length-1;i++) {
      if(arr[i]===arr[i+1]){arr[i]*=2;s.score+=arr[i];arr.splice(i+1,1);}
    }
    while(arr.length<4) arr.push(0);
    return arr;
  }

  if(dir==='left')  {for(let r=0;r<4;r++) b[r]=slide(b[r]);}
  if(dir==='right') {for(let r=0;r<4;r++) b[r]=slide([...b[r]].reverse()).reverse();}
  if(dir==='up')    {for(let c=0;c<4;c++){let col=b.map(r=>r[c]);col=slide(col);col.forEach((v,r)=>b[r][c]=v);}}
  if(dir==='down')  {for(let c=0;c<4;c++){let col=b.map(r=>r[c]).reverse();col=slide(col).reverse();col.forEach((v,r)=>b[r][c]=v);}}

  if(JSON.stringify(b)!==prev) {
    add2048Tile();
    if(s.score>s.best){s.best=s.score;localStorage.setItem('2048best',s.best);}
    // Check win
    if(!s.won && b.some(row=>row.some(v=>v>=2048))){
      s.won=true; setStatus('🎉 Đã đạt 2048! Tiếp tục để phá kỷ lục!','var(--cyan)');
    }
    // Check lose
    if(!can2048Move(b)){s.over=true;setStatus(`Thua rồi! Điểm: ${s.score} 💀`,'var(--pink)');}
    render2048();
  }
}

function can2048Move(b) {
  for(let r=0;r<4;r++) for(let c=0;c<4;c++) {
    if(!b[r][c]) return true;
    if(c<3&&b[r][c]===b[r][c+1]) return true;
    if(r<3&&b[r][c]===b[r+1][c]) return true;
  }
  return false;
}

function getTileClass(v) {
  if(!v) return 'e';
  const map={2:'t2',4:'t4',8:'t8',16:'t16',32:'t32',64:'t64',128:'t128',256:'t256',512:'t512',1024:'t1024',2048:'t2048'};
  return map[v]||'tBig';
}

function render2048() {
  const s=gameState;
  document.getElementById('gameBoard').innerHTML=`
    <div class="g2048-score">
      <div class="g2048-stat"><span class="g2048-stat-label">Điểm</span><span class="g2048-stat-val" id="sc2048">${s.score}</span></div>
      <div class="g2048-stat"><span class="g2048-stat-label">Kỷ lục</span><span class="g2048-stat-val">${s.best}</span></div>
    </div>
    <div class="g2048-board">
      ${s.board.map(row=>row.map(v=>`<div class="g2048-cell ${getTileClass(v)}">${v||''}</div>`).join('')).join('')}
    </div>
    <div class="g2048-hint">⬆ ⬇ ⬅ ➡ Nhấn phím mũi tên để di chuyển</div>
    <div class="g2048-btns">
      <button class="btn-sm btn-sm-outline" onclick="move2048('up')">⬆</button>
      <button class="btn-sm btn-sm-outline" onclick="move2048('left')">⬅</button>
      <button class="btn-sm btn-sm-outline" onclick="move2048('down')">⬇</button>
      <button class="btn-sm btn-sm-outline" onclick="move2048('right')">➡</button>
    </div>`;
}

// ==================================
// 12. AI LÀ TRIỆU PHÚ
// ==================================
const MILLION_PRIZES = [
  '1.000đ','2.000đ','3.000đ','5.000đ','10.000đ',
  '20.000đ','40.000đ','80.000đ','150.000đ','250.000đ',
  '500.000đ','1.000.000đ','2.000.000đ','5.000.000đ','1.000.000.000đ'
];
const SAFE_LEVELS = [4, 9, 14]; // 0-indexed: câu 5, 10, 15

const MILLION_QUESTIONS = [
  // Dễ (level 0)
  {q:'Ngôn ngữ lập trình nào được tạo ra bởi Guido van Rossum?',a:['Java','Python','Ruby','Go'],c:1,lv:0},
  {q:'HTML là viết tắt của?',a:['HyperText Markup Language','High Tech Machine Learning','Home Tool Markup Language','Hyper Transfer Mode Language'],c:0,lv:0},
  {q:'Git được tạo ra bởi ai?',a:['Mark Zuckerberg','Linus Torvalds','Bill Gates','Steve Jobs'],c:1,lv:0},
  {q:'CSS là viết tắt của?',a:['Creative Style Sheets','Cascading Style Sheets','Computer Style System','Code Style Standard'],c:1,lv:0},
  {q:'Phím tắt Ctrl+Z dùng để làm gì?',a:['Copy','Paste','Undo','Save'],c:2,lv:0},
  {q:'RAM là viết tắt của?',a:['Random Access Memory','Read All Memory','Remote Access Module','Run After Mode'],c:0,lv:0},
  {q:'"Hello World" thường được dùng để làm gì?',a:['Test kết nối mạng','Chương trình đầu tiên học lập trình','Tên một framework','Test bảo mật'],c:1,lv:0},
  {q:'Đơn vị lưu trữ nào lớn hơn?',a:['MB','KB','GB','Byte'],c:2,lv:0},
  {q:'URL là viết tắt của?',a:['Uniform Resource Locator','Universal Read Link','User Request Log','Unified Remote Location'],c:0,lv:0},
  {q:'Công ty nào tạo ra hệ điều hành Windows?',a:['Apple','Google','Microsoft','IBM'],c:2,lv:0},
  // Trung bình (level 1)
  {q:'Protocol nào dùng để gửi email?',a:['HTTP','FTP','SMTP','SSH'],c:2,lv:1},
  {q:'Design pattern nào tách biệt interface và implementation?',a:['Singleton','Factory','Bridge','Observer'],c:2,lv:1},
  {q:'Trong JavaScript, closure là gì?',a:['Hàm đóng gói biến cục bộ','Hàm truy cập biến của outer scope','Class đóng gói data','Method của object'],c:1,lv:1},
  {q:'Thuật toán nào có độ phức tạp O(n log n) trung bình?',a:['Bubble Sort','Insertion Sort','Merge Sort','Selection Sort'],c:2,lv:1},
  {q:'Docker container khác VM ở điểm nào?',a:['Docker chạy chậm hơn','Docker dùng chung OS kernel','Docker cần nhiều RAM hơn','Docker không thể chạy trên Linux'],c:1,lv:1},
  {q:'HTTP method nào được coi là idempotent?',a:['POST','PATCH','PUT','DELETE'],c:2,lv:1},
  {q:'Index trong database giúp gì?',a:['Tăng dung lượng','Tăng tốc độ query','Mã hoá dữ liệu','Backup tự động'],c:1,lv:1},
  {q:'CAP theorem nói về điều gì?',a:['CPU, API, Protocol','Consistency, Availability, Partition tolerance','Cache, Auth, Performance','Code, Architecture, Pipeline'],c:1,lv:1},
  {q:'Trong React, key prop dùng để làm gì?',a:['CSS styling','Event handling','Giúp React identify list items','Passing data to child'],c:2,lv:1},
  {q:'OAuth 2.0 là gì?',a:['Database protocol','Authorization framework','Encryption algorithm','Routing protocol'],c:1,lv:1},
  // Khó (level 2)
  {q:'SOLID: Liskov Substitution Principle nói gì?',a:['Class chỉ có 1 lý do thay đổi','Subtype phải thay thế được supertype','Depend on abstractions','Open for extension, closed for modification'],c:1,lv:2},
  {q:'Event Loop trong Node.js hoạt động như thế nào?',a:['Multi-thread xử lý song song','Single-thread với non-blocking I/O qua callback queue','Multi-process fork','Synchronous execution only'],c:1,lv:2},
  {q:'Consistent Hashing giải quyết vấn đề gì?',a:['SQL query optimization','Phân phối load khi thêm/bỏ server trong distributed system','Memory management','Thread synchronization'],c:1,lv:2},
  {q:'GraphQL khác REST ở điểm quan trọng nào?',a:['GraphQL chỉ dùng GET','Client specify exactly what data they need','GraphQL không cần server','GraphQL nhanh hơn 10x'],c:1,lv:2},
  {q:'Thuật toán Dijkstra dùng để làm gì?',a:['Sort mảng','Tìm đường đi ngắn nhất trong graph','Binary search','Mã hoá dữ liệu'],c:1,lv:2},
  {q:'WebAssembly (WASM) là gì?',a:['JavaScript framework','Binary instruction format chạy trong browser gần tốc độ native','Database query language','CSS preprocessor'],c:1,lv:2},
  {q:'Byzantine Fault Tolerance trong distributed systems đề cập đến?',a:['Network latency','Xử lý khi một số node gửi thông tin sai/malicious','Database replication','Load balancing'],c:1,lv:2},
  {q:'Service Mesh giải quyết vấn đề gì trong microservices?',a:['Database scaling','Infrastructure layer xử lý service-to-service communication','Frontend routing','File storage'],c:1,lv:2},
  {q:'Trong cryptography, Perfect Forward Secrecy đảm bảo gì?',a:['Permanent encryption','Compromise session key cũ không ảnh hưởng session tương lai','Không cần private key','Hash không thể bẻ'],c:1,lv:2},
  {q:'CRDT (Conflict-free Replicated Data Type) dùng trong trường hợp nào?',a:['SQL optimization','Đồng bộ data phân tán không cần lock hay conflict resolution','Image compression','Network routing'],c:1,lv:2},
];

function initMillionaire() {
  const lv = getLevel();
  // Lọc câu hỏi theo level, shuffle
  const pool = MILLION_QUESTIONS
    .filter(q => lv === 0 ? q.lv === 0 : lv === 1 ? q.lv <= 1 : true)
    .sort(() => Math.random() - 0.5);
  // Lấy 15 câu (5 dễ, 5 tb, 5 khó hoặc mix)
  let selected = [];
  if(lv === 0) selected = pool.filter(q=>q.lv===0).slice(0,15);
  else if(lv === 1) selected = [...pool.filter(q=>q.lv===0).slice(0,5),...pool.filter(q=>q.lv===1).slice(0,10)];
  else selected = [...pool.filter(q=>q.lv===0).slice(0,5),...pool.filter(q=>q.lv===1).slice(0,5),...pool.filter(q=>q.lv===2).slice(0,5)];
  while(selected.length < 15) selected.push(...pool.slice(0, 15-selected.length));
  selected = selected.slice(0,15);

  gameState = {
    questions: selected, current: 0, over: false,
    lifelines: {fifty:false, phone:false, audience:false},
    eliminated: [], prize: '0đ'
  };
  document.getElementById('scoreboard').style.display = 'none';
  setStatus('🎰 Ai Là Triệu Phú — Trả lời 15 câu để thắng 1 tỷ đồng!');
  renderMillionaire();
}

function renderMillionaire() {
  const s = gameState;
  if(s.current >= s.questions.length) return;
  const q = s.questions[s.current];
  const letters = ['A','B','C','D'];

  // Shuffle answers
  const ansArr = q.a.map((a,i)=>({text:a,orig:i})).sort(()=>Math.random()-.5);
  gameState.ansOrder = ansArr;
  const correctShuffled = ansArr.findIndex(a=>a.orig===q.c);
  gameState.correctShuffled = correctShuffled;

  const optsHtml = ansArr.map((a,i)=>{
    const elim = s.eliminated.includes(i) ? 'eliminated' : '';
    return `<button class="million-opt ${elim}" id="mopt${i}" onclick="millionaireAnswer(${i})" ${elim?'disabled':''}>
      <span class="opt-letter">${letters[i]}:</span>${a.text}
    </button>`;
  }).join('');

  // Prize ladder (hiển thị 8 câu gần nhất)
  const start = Math.max(0, s.current - 3);
  const ladderItems = Array.from({length:15},(_,i)=>i)
    .filter(i => i >= start && i <= Math.min(14, start+7))
    .reverse()
    .map(i => {
      let cls = 'inactive';
      if(i === s.current) cls = 'current';
      else if(i < s.current) cls = 'passed';
      if(SAFE_LEVELS.includes(i)) cls += ' safe';
      return `<div class="million-rung ${cls}"><span>Câu ${i+1}</span><span class="million-prize">${MILLION_PRIZES[i]}</span></div>`;
    }).join('');

  document.getElementById('gameBoard').innerHTML = `
    <div class="millionaire-wrap">
      <div class="million-lifelines">
        <button class="lifeline-btn" id="ll-fifty" onclick="lifelineFifty()" ${s.lifelines.fifty?'disabled':''}>
          ${s.lifelines.fifty?'✅':'💡'} 50:50
        </button>
        <button class="lifeline-btn" id="ll-phone" onclick="lifelinePhone()" ${s.lifelines.phone?'disabled':''}>
          ${s.lifelines.phone?'✅':'📞'} Gọi Bạn
        </button>
        <button class="lifeline-btn" id="ll-audience" onclick="lifelineAudience()" ${s.lifelines.audience?'disabled':''}>
          ${s.lifelines.audience?'✅':'👥'} Hỏi Khán Giả
        </button>
      </div>
      <div class="million-q">
        <div style="font-family:var(--mono);font-size:.65rem;color:var(--muted);margin-bottom:8px;">Câu ${s.current+1}/15 — ${MILLION_PRIZES[s.current]}</div>
        ${q.q}
      </div>
      <div class="million-opts">${optsHtml}</div>
      <div class="million-ladder">${ladderItems}</div>
    </div>`;
}

function millionaireAnswer(idx) {
  const s = gameState; if(s.over) return;
  const correct = s.correctShuffled;
  const btn = document.getElementById('mopt'+idx);
  const correctBtn = document.getElementById('mopt'+correct);

  // Disable all
  document.querySelectorAll('.million-opt').forEach(b=>b.disabled=true);

  if(idx === correct) {
    btn.classList.add('correct');
    setTimeout(() => {
      s.current++;
      if(s.current >= 15) {
        s.over = true;
        setStatus('🏆 Chúc mừng! Bạn thắng 1.000.000.000đ! 🎉', 'var(--cyan)');
        document.getElementById('gameBoard').innerHTML = `
          <div style="text-align:center;padding:48px 20px;">
            <div style="font-size:4rem;margin-bottom:16px;">🏆</div>
            <div style="font-family:var(--display);font-size:2rem;color:var(--cyan);margin-bottom:8px;">AI LÀ TRIỆU PHÚ!</div>
            <div style="font-family:var(--mono);font-size:1rem;color:var(--text);">1.000.000.000đ</div>
          </div>`;
      } else {
        s.eliminated = [];
        if(SAFE_LEVELS.includes(s.current-1)) {
          setStatus(`✅ Đạt mốc an toàn: ${MILLION_PRIZES[s.current-1]}! Tiếp tục nào!`, 'var(--green)');
          setTimeout(renderMillionaire, 1200);
        } else {
          setStatus(`✅ Đúng rồi! Bạn đang có ${MILLION_PRIZES[s.current-1]}`, 'var(--green)');
          setTimeout(renderMillionaire, 900);
        }
      }
    }, 1000);
  } else {
    btn.classList.add('wrong');
    correctBtn.classList.add('correct');
    s.over = true;
    const safePrize = SAFE_LEVELS.filter(l=>l<s.current).pop();
    const finalPrize = safePrize !== undefined ? MILLION_PRIZES[safePrize] : '0đ';
    setTimeout(() => {
      setStatus(`❌ Sai rồi! Đáp án đúng là ${['A','B','C','D'][s.correctShuffled]}. Bạn nhận được ${finalPrize}`, 'var(--pink)');
    }, 800);
  }
}

// -- LIFELINES --
function lifelineFifty() {
  const s = gameState; if(s.lifelines.fifty || s.over) return;
  s.lifelines.fifty = true;
  document.getElementById('ll-fifty').disabled = true;
  document.getElementById('ll-fifty').textContent = '✅ 50:50';
  // Loại 2 đáp án sai
  const wrongs = [0,1,2,3].filter(i=>i!==s.correctShuffled && !s.eliminated.includes(i));
  const toElim = wrongs.sort(()=>Math.random()-.5).slice(0,2);
  toElim.forEach(i => {
    s.eliminated.push(i);
    const btn = document.getElementById('mopt'+i);
    if(btn) { btn.classList.add('eliminated'); btn.disabled=true; }
  });
  setStatus('💡 50:50: Đã loại 2 đáp án sai!', 'var(--violet)');
}

function lifelinePhone() {
  const s = gameState; if(s.lifelines.phone || s.over) return;
  s.lifelines.phone = true;
  document.getElementById('ll-phone').disabled = true;
  document.getElementById('ll-phone').textContent = '✅ Gọi Bạn';
  const correct = s.correctShuffled;
  const letters = ['A','B','C','D'];
  const confidence = [70,85,90,95][getLevel()] + Math.floor(Math.random()*10);
  // Người bạn có thể sai ở level khó
  const isRight = getLevel() <= 1 || Math.random() > 0.15;
  const hint = isRight ? correct : [0,1,2,3].filter(i=>i!==correct)[Math.floor(Math.random()*3)];
  setStatus(`📞 Bạn nói: "Mình nghĩ ${confidence}% là đáp án ${letters[hint]}!"`, 'var(--blue)');
}

function lifelineAudience() {
  const s = gameState; if(s.lifelines.audience || s.over) return;
  s.lifelines.audience = true;
  document.getElementById('ll-audience').disabled = true;
  document.getElementById('ll-audience').textContent = '✅ Hỏi KG';
  const correct = s.correctShuffled;
  const letters = ['A','B','C','D'];
  // Tạo phần trăm bình chọn
  let pcts = [5,5,5,5];
  const mainPct = getLevel()<=1 ? 55+Math.floor(Math.random()*25) : 35+Math.floor(Math.random()*30);
  pcts[correct] = mainPct;
  let remaining = 100 - mainPct;
  [0,1,2,3].filter(i=>i!==correct).forEach((i,idx,arr)=>{
    if(idx===arr.length-1) pcts[i]=remaining;
    else { const v=Math.floor(remaining/(arr.length-idx)); pcts[i]=v; remaining-=v; }
  });
  const bars = pcts.map((p,i)=>`<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
    <span style="font-family:var(--mono);font-size:.7rem;color:var(--cyan);min-width:14px">${letters[i]}</span>
    <div style="flex:1;background:rgba(255,255,255,.06);border-radius:4px;height:16px;overflow:hidden">
      <div style="width:${p}%;height:100%;background:linear-gradient(90deg,var(--violet),var(--cyan));transition:width .5s"></div>
    </div>
    <span style="font-family:var(--mono);font-size:.7rem;color:var(--text);min-width:30px">${p}%</span>
  </div>`).join('');
  setStatus(`👥 Khán giả bình chọn:`, 'var(--violet)');
  const statusEl = document.getElementById('gameStatus');
  statusEl.innerHTML = `<div style="width:100%">👥 Khán giả bình chọn:<br><div style="margin-top:8px">${bars}</div></div>`;
}


// ==================================
// BLACKJACK
// ==================================
const BJ_SUITS=['♠','♥','♦','♣'];const BJ_VALS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function bjDeck(){const d=[];BJ_SUITS.forEach(s=>BJ_VALS.forEach(v=>d.push({s,v})));return d.sort(()=>Math.random()-.5);}
function bjVal(v){if(['J','Q','K'].includes(v))return 10;if(v==='A')return 11;return parseInt(v);}
function bjHandVal(hand){let t=hand.filter(c=>!c.hidden).reduce((s,c)=>s+bjVal(c.v),0);let aces=hand.filter(c=>c.v==='A'&&!c.hidden).length;while(t>21&&aces>0){t-=10;aces--;}return t;}
function initBlackjack(){
  const stakes=[10,50,200][getLevel()];
  gameState={deck:bjDeck(),player:[],dealer:[],bet:stakes,chips:500,over:false,stakes};
  document.getElementById('scoreboard').style.display='none';
  setStatus(`Blackjack — ${stakes} chip mỗi ván 🃏`);
  bjDeal();
}
function bjDeal(){
  const s=gameState;s.over=false;s.playerActed=false;s.deck=bjDeck();
  s.player=[s.deck.pop(),s.deck.pop()];
  s.dealer=[s.deck.pop(),{...s.deck.pop(),hidden:true}];
  s.chips-=s.bet;
  renderBJ();
  if(bjHandVal(s.player)===21){setTimeout(bjStand,600);}
  else setStatus(`Chips: ${s.chips+s.bet} | Đặt cược: ${s.bet} — Rút hay Dừng?`);
}
function bjHit(){
  const s=gameState;if(s.over)return;
  s.playerActed=true;
  s.player.push(s.deck.pop());renderBJ();
  if(bjHandVal(s.player)>21){s.over=true;setStatus(`💥 Bust! Thua ${s.bet} chip — Chips còn: ${s.chips}`,'var(--pink)');renderBJ();}
  else if(bjHandVal(s.player)===21){setTimeout(bjStand,400);}
}
function bjStand(){
  const s=gameState;if(s.over)return;
  s.dealer=s.dealer.map(c=>({...c,hidden:false}));
  while(bjHandVal(s.dealer)<17)s.dealer.push(s.deck.pop());
  const pv=bjHandVal(s.player),dv=bjHandVal(s.dealer);
  s.over=true;
  let msg,col;
  if(dv>21||pv>dv){s.chips+=s.bet*2;msg=`🎉 Thắng! +${s.bet} chip — Chips: ${s.chips}`;col='var(--green)';}
  else if(pv===dv){s.chips+=s.bet;msg=`🤝 Hòa! Hoàn lại ${s.bet} chip — Chips: ${s.chips}`;col='var(--orange)';}
  else{msg=`💀 Thua ${s.bet} chip — Chips: ${s.chips}`;col='var(--pink)';}
  setStatus(msg,col);renderBJ();
}
function bjDouble(){
  const s=gameState;if(s.over||s.player.length>2||s.doubled)return;
  s.doubled=true;
  s.chips-=s.bet;s.bet*=2;
  s.player.push(s.deck.pop());renderBJ();
  if(bjHandVal(s.player)>21){s.over=true;setStatus(`💥 Bust! Thua ${s.bet} chip — Chips: ${s.chips}`,'var(--pink)');}
  else setTimeout(bjStand,400);
}
function bjCardHtml(c){
  if(c.hidden)return`<div class="bj-card hidden">🂠</div>`;
  const red=['♥','♦'].includes(c.s)?'red':'black';
  return`<div class="bj-card ${red}"><span>${c.v}</span><span class="bj-card-suit">${c.s}</span></div>`;
}
function renderBJ(){
  const s=gameState;
  const dealerVal=s.dealer.filter(c=>!c.hidden).reduce((t,c)=>t+bjVal(c.v),0);
  document.getElementById('gameBoard').innerHTML=`
  <div class="bj-table">
    <div class="bj-hand">
      <div class="bj-hand-label">🤖 Dealer <span class="bj-hand-val">${s.over?bjHandVal(s.dealer):dealerVal}</span></div>
      <div class="bj-cards">${s.dealer.map(bjCardHtml).join('')}</div>
    </div>
    <div class="bj-hand">
      <div class="bj-hand-label">👤 Bạn <span class="bj-hand-val">${bjHandVal(s.player)}</span></div>
      <div class="bj-cards">${s.player.map(bjCardHtml).join('')}</div>
    </div>
    <div class="bj-actions">
      ${s.over
        ?`<button class="btn-sm btn-sm-cyan" onclick="bjDeal()">🃏 Ván mới (${s.bet} chip)</button>`
        :`<button class="btn-sm btn-sm-cyan" onclick="bjHit()">Rút thêm</button>
          <button class="btn-sm btn-sm-outline" onclick="bjStand()">Dừng</button>
          ${s.player.filter(c=>!c.hidden).length===2&&!s.playerActed?`<button class="btn-sm" style="background:rgba(255,107,53,.15);color:var(--orange);border:1px solid rgba(255,107,53,.25)" onclick="bjDouble()">Gấp đôi</button>`:''}`
      }
    </div>
    <div style="text-align:center;margin-top:10px;font-family:var(--mono);font-size:.7rem;color:var(--muted)">💰 Chips: <span style="color:var(--cyan)">${s.chips}</span></div>
  </div>`;
}

// ==================================
// ANAGRAM
// ==================================
const ANAGRAM_WORDS = {
  0: [{w:'ARRAY',h:'Cấu trúc dữ liệu cơ bản',cat:'Data'},{w:'STACK',h:'LIFO data structure',cat:'Data'},{w:'QUEUE',h:'FIFO data structure',cat:'Data'},{w:'LOOPS',h:'Vòng lặp trong code',cat:'Code'},{w:'CLASS',h:'OOP building block',cat:'Code'},{w:'CACHE',h:'Lưu trữ tạm thời',cat:'System'},{w:'DEBUG',h:'Tìm và sửa lỗi',cat:'Dev'},{w:'QUERY',h:'Truy vấn database',cat:'DB'},{w:'PATCH',h:'HTTP update method',cat:'Web'},{w:'TOKEN',h:'Auth credential',cat:'Security'}],
  1: [{w:'BINARY',h:'Base-2 number system',cat:'CS'},{w:'DOCKER',h:'Container platform',cat:'DevOps'},{w:'GITHUB',h:'Code hosting platform',cat:'Dev'},{w:'PYTHON',h:'Snake language 🐍',cat:'Language'},{w:'ROUTER',h:'Điều hướng request',cat:'Network'},{w:'THREAD',h:'Đơn vị thực thi',cat:'System'},{w:'OBJECT',h:'Instance của class',cat:'OOP'},{w:'BRANCH',h:'Git feature line',cat:'Git'},{w:'KERNEL',h:'OS core',cat:'System'},{w:'LAMBDA',h:'Hàm ẩn danh',cat:'FP'}],
  2: [{w:'CLOSURE',h:'Function captures outer scope',cat:'JS'},{w:'PROMISE',h:'Async operation result',cat:'JS'},{w:'POINTER',h:'Memory address variable',cat:'C/C++'},{w:'BACKEND',h:'Server-side code',cat:'Dev'},{w:'RUNTIME',h:'Program execution time',cat:'CS'},{w:'WEBHOOK',h:'HTTP callback',cat:'API'},{w:'BOOLEAN',h:'True or false type',cat:'Types'},{w:'POLYMER',h:'Google web components lib',cat:'Web'},{w:'CLUSTER',h:'Group of servers',cat:'Infra'},{w:'DATASET',h:'Collection of data',cat:'Data'}],
};
function initAnagram(){
  const pool=ANAGRAM_WORDS[getLevel()].sort(()=>Math.random()-.5);
  const item=pool[0];
  const scrambled=[...item.w].sort(()=>Math.random()-.5);
  // Ensure not same as original
  let tries=0;while(scrambled.join('')===item.w&&tries++<20)[...scrambled].sort(()=>Math.random()-.5).forEach((v,i)=>scrambled[i]=v);
  gameState={words:pool,idx:0,current:item,scrambled,selected:[],answer:[],score:0,hints:2,over:false};
  document.getElementById('scoreboard').style.display='none';
  setStatus(`Sắp xếp chữ cái thành từ IT đúng 🔤`);
  renderAnagram();
}
function anagramPickLetter(i){
  const s=gameState;if(s.over)return;
  if(s.selected.includes(i))return;
  s.selected.push(i);s.answer.push(s.scrambled[i]);
  if(s.answer.length===s.current.w.length){
    const ans=s.answer.join('');
    if(ans===s.current.w){
      s.score++;setStatus(`✅ Đúng! "${s.current.w}" — ${s.score}/${s.words.length}点`,'var(--green)');
      setTimeout(()=>{
        s.idx++;if(s.idx>=s.words.length){setStatus(`🎉 Hoàn thành! ${s.score}/${s.words.length} đúng`,'var(--cyan)');return;}
        const item=s.words[s.idx];s.current=item;
        const sc=[...item.w].sort(()=>Math.random()-.5);
        s.scrambled=sc;s.selected=[];s.answer=[];renderAnagram();
        setStatus(`Từ ${s.idx+1}/${s.words.length}`);
      },1000);
    } else {
      setStatus(`❌ Sai rồi! Thử lại`,'var(--pink)');
      setTimeout(()=>{s.selected=[];s.answer=[];renderAnagram();setStatus(`Sắp xếp chữ cái thành từ IT 🔤`);},800);
    }
  } else renderAnagram();
}
function anagramRemove(){
  const s=gameState;if(!s.answer.length)return;
  const idx=s.selected.pop();s.answer.pop();renderAnagram();
}
function anagramHint(){
  const s=gameState;if(s.hints<=0){setStatus('Đã hết trợ giúp!','var(--orange)');return;}
  s.hints--;setStatus(`💡 Gợi ý: ${s.current.h} (${s.hints} trợ giúp còn lại)`,'var(--violet)');
}
function renderAnagram(){
  const s=gameState;const w=s.current;
  document.getElementById('gameBoard').innerHTML=`
  <div class="anagram-wrap">
    <span class="anagram-category">${w.cat}</span>
    <div style="font-family:var(--mono);font-size:.65rem;color:var(--muted);margin-bottom:6px">Từ ${s.idx+1}/${s.words.length} · ✅ ${s.score} đúng · 💡 ${s.hints} gợi ý</div>
    <div class="anagram-answer">
      ${Array(w.w.length).fill(0).map((_,i)=>`<div class="anagram-slot ${i<s.answer.length?'filled':''}" onclick="anagramRemove()">${s.answer[i]||''}</div>`).join('')}
    </div>
    <div class="anagram-scrambled">
      ${s.scrambled.map((l,i)=>`<div class="anagram-letter ${s.selected.includes(i)?'selected':''}" onclick="anagramPickLetter(${i})">${s.selected.includes(i)?'·':l}</div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn-sm btn-sm-outline" onclick="anagramHint()">💡 Hint (${s.hints})</button>
      <button class="btn-sm btn-sm-outline" onclick="initAnagram()">↺ New</button>
    </div>
  </div>`;
}

// ==================================
// SUDOKU
// ==================================
function initSudoku(){
  const lv=getLevel();
  const blanks=[35,46,55][lv];
  const base=solveSudoku(genSudokuBase());
  const board=base.map(r=>[...r]);const given=board.map(r=>[...r]);
  // Remove cells
  let removed=0;const cells=[...Array(81).keys()].sort(()=>Math.random()-.5);
  cells.forEach(i=>{if(removed<blanks){const r=Math.floor(i/9),c=i%9;board[r][c]=0;removed++;}});
  gameState={board,given,solution:base,selected:null,errors:new Set(),over:false};
  document.getElementById('scoreboard').style.display='none';
  setStatus(`Sudoku — Điền số 1-9 vào ô trống 🧮`);
  renderSudoku();
}
function genSudokuBase(){
  const b=Array(9).fill(0).map(()=>Array(9).fill(0));
  fillSudoku(b,0,0);return b;
}
function fillSudoku(b,r,c){
  if(r===9)return true;const nr=c===8?r+1:r,nc=c===8?0:c+1;
  const nums=[1,2,3,4,5,6,7,8,9].sort(()=>Math.random()-.5);
  for(const n of nums){
    if(canPlaceSudoku(b,r,c,n)){b[r][c]=n;if(fillSudoku(b,nr,nc))return true;b[r][c]=0;}
  }
  return false;
}
function canPlaceSudoku(b,r,c,n){
  if(b[r].includes(n))return false;
  if(b.some(row=>row[c]===n))return false;
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let i=br;i<br+3;i++)for(let j=bc;j<bc+3;j++)if(b[i][j]===n)return false;
  return true;
}
function solveSudoku(b){const copy=b.map(r=>[...r]);fillSudoku(copy,0,0);return copy;}
function sudokuSelect(r,c){
  const s=gameState;if(s.given[r][c])return;
  s.selected=s.selected&&s.selected[0]===r&&s.selected[1]===c?null:[r,c];
  renderSudoku();
}
function sudokuInput(n){
  const s=gameState;if(!s.selected||s.over)return;
  const[r,c]=s.selected;
  s.board[r][c]=n;
  const key=`${r},${c}`;
  if(n!==0&&n!==s.solution[r][c])s.errors.add(key);else s.errors.delete(key);
  if(s.board.every((row,ri)=>row.every((v,ci)=>v===s.solution[ri][ci]))){
    s.over=true;setStatus('🎉 Hoàn thành! Xuất sắc!','var(--green)');
  }
  renderSudoku();
}
function renderSudoku(){
  const s=gameState;
  let cells='';
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const isGiven=s.given[r][c]!==0;
    const isSel=s.selected&&s.selected[0]===r&&s.selected[1]===c;
    const isErr=s.errors.has(`${r},${c}`);
    const isHL=s.selected&&!isSel&&(s.selected[0]===r||s.selected[1]===c||
      (Math.floor(s.selected[0]/3)===Math.floor(r/3)&&Math.floor(s.selected[1]/3)===Math.floor(c/3)));
    const isCorrect=!isGiven&&s.board[r][c]&&s.board[r][c]===s.solution[r][c];
    const boxR=c===2||c===5?'box-right':'';const boxB=r===2||r===5?'box-bottom':'';
    let cls=`sudoku-cell ${boxR} ${boxB}`;
    if(isGiven)cls+=' given';else if(isErr)cls+=' error';else if(isCorrect)cls+=' correct';
    if(isSel)cls+=' selected';else if(isHL)cls+=' highlight';
    cells+=`<div class="${cls}" onclick="sudokuSelect(${r},${c})">${s.board[r][c]||''}</div>`;
  }
  const numpad=Array.from({length:9},(_,i)=>`<button class="sudoku-num" onclick="sudokuInput(${i+1})">${i+1}</button>`).join('')+
    `<button class="sudoku-num" onclick="sudokuInput(0)" style="font-size:.6rem;color:var(--pink)">✕</button>`;
  document.getElementById('gameBoard').innerHTML=`
    <div style="text-align:center;font-family:var(--mono);font-size:.65rem;color:var(--pink);margin-bottom:6px">${s.errors.size>0?`❌ ${s.errors.size} lỗi`:''}</div>
    <div class="sudoku-board">${cells}</div>
    <div class="sudoku-numpad">${numpad}</div>`;
}

// ==================================
// PONG
// ==================================
function initPong(){
  const W=480,H=280,speed=[3,5,7][getLevel()];
  gameState={W,H,ball:{x:W/2,y:H/2,vx:speed,vy:speed*(Math.random()>.5?1:-1)},
    p1:{y:H/2-30,h:60,score:0},p2:{y:H/2-30,h:60,score:0},
    over:false,paused:false,keys:{},speed};
  document.getElementById('scoreboard').style.display='none';
  setStatus('W/S hoặc ↑/↓ để điều khiển — Đánh bại Máy! 🏓');
  document.getElementById('gameBoard').innerHTML=`
    <canvas id="pong-canvas" width="${W}" height="${H}"></canvas>
    <div class="pong-controls"><span>W/S: Di chuyển</span><span id="pong-score">0 : 0</span><span>Máy: Tự động</span></div>`;
  document.removeEventListener('keydown',pongKey);document.removeEventListener('keyup',pongKeyUp);
  document.addEventListener('keydown',pongKey);document.addEventListener('keyup',pongKeyUp);
  if(gameState.pongRAF)cancelAnimationFrame(gameState.pongRAF);
  showCountdown(()=>pongLoop());
}
function pongKey(e){if(!gameState||!gameState.keys)return;if(['w','s','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();gameState.keys[e.key]=true;}}
function pongKeyUp(e){if(gameState&&gameState.keys&&['w','s','ArrowUp','ArrowDown'].includes(e.key))gameState.keys[e.key]=false;}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(typeof gameState!=='undefined'){
      if(gameState.pongRAF){cancelAnimationFrame(gameState.pongRAF);gameState.pongRAF=null;}
      if(gameState.flappyRAF){cancelAnimationFrame(gameState.flappyRAF);gameState.flappyRAF=null;}
    }
  } else {
    if(typeof gameState!=='undefined'&&typeof currentGame!=='undefined'){
      if(currentGame==='pong'&&gameState.p1&&!gameState.over) pongLoop();
      if(currentGame==='flappy'&&gameState.bird&&!gameState.over) flappyLoop();
    }
  }
});
function pongLoop(){
  const s=gameState;if(!s||s.over){return;}
  const c=document.getElementById('pong-canvas');if(!c){return;}
  const ctx=c.getContext('2d');const{W,H,ball,p1,p2}=s;
  // Move player
  const spd=5;
  if(s.keys['w']||s.keys['ArrowUp']){p1.y=Math.max(0,p1.y-spd);}
  if(s.keys['s']||s.keys['ArrowDown']){p1.y=Math.min(H-p1.h,p1.y+spd);}
  // AI
  const aiSpd=[2,4,6][getLevel()];
  const target=ball.y-p2.h/2;
  if(p2.y<target)p2.y=Math.min(p2.y+aiSpd,H-p2.h);
  else p2.y=Math.max(p2.y-aiSpd,0);
  // Ball
  ball.x+=ball.vx;ball.y+=ball.vy;
  if(ball.y<=0||ball.y>=H-8){ball.vy*=-1;}
  // Paddles
  if(ball.x<=18&&ball.y>=p1.y&&ball.y<=p1.y+p1.h){ball.vx=Math.abs(ball.vx);ball.vy+=((ball.y-p1.y-p1.h/2)/p1.h)*3;}
  if(ball.x>=W-26&&ball.y>=p2.y&&ball.y<=p2.y+p2.h){ball.vx=-Math.abs(ball.vx);ball.vy+=((ball.y-p2.y-p2.h/2)/p2.h)*3;}
  // Score
  if(ball.x<0){p2.score++;ball.x=W/2;ball.y=H/2;ball.vx=s.speed;ball.vy=s.speed*(Math.random()>.5?1:-1);document.getElementById('pong-score').textContent=`${p1.score} : ${p2.score}`;}
  if(ball.x>W){p1.score++;ball.x=W/2;ball.y=H/2;ball.vx=-s.speed;ball.vy=s.speed*(Math.random()>.5?1:-1);document.getElementById('pong-score').textContent=`${p1.score} : ${p2.score}`;}
  if(p1.score>=7||p2.score>=7){s.over=true;setStatus(p1.score>=7?'🎉 Bạn thắng!':'💀 Máy thắng!',p1.score>=7?'var(--green)':'var(--pink)');return;}
  // Draw
  ctx.fillStyle='#03040a';ctx.fillRect(0,0,W,H);
  ctx.setLineDash([6,6]);ctx.strokeStyle='rgba(255,255,255,.1)';ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#00f5d4';ctx.fillRect(10,p1.y,8,p1.h);
  ctx.fillStyle='#f72585';ctx.fillRect(W-18,p2.y,8,p2.h);
  ctx.fillStyle='#f0f2f8';ctx.beginPath();ctx.arc(ball.x,ball.y,6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(0,245,212,.3)';ctx.font='bold 24px monospace';
  ctx.fillText(p1.score,W/2-36,30);ctx.fillStyle='rgba(247,37,133,.3)';ctx.fillText(p2.score,W/2+20,30);
  if(!document.hidden) s.pongRAF=requestAnimationFrame(pongLoop);
}

// ==================================
// FLAPPY BIRD
// ==================================
function initFlappy(){
  const W=360,H=520,gap=[160,130,100][getLevel()];
  gameState={W,H,gap,bird:{y:H/2,vy:0},pipes:[],score:0,over:false,started:false,frame:0};
  document.getElementById('scoreboard').style.display='none';
  setStatus('Nhấp / Phím cách để nhảy — Tránh ống! 🐦');
  document.getElementById('gameBoard').innerHTML=`<canvas id="flappy-canvas" width="${W}" height="${H}" onclick="flappyJump()"></canvas>`;
  document.removeEventListener('keydown',flappyKey);
  document.addEventListener('keydown',flappyKey);
  if(gameState.flappyRAF)cancelAnimationFrame(gameState.flappyRAF);
  flappyLoop();
}
function flappyKey(e){if(e.code==='Space'){e.preventDefault();flappyJump();}}
function flappyJump(){const s=gameState;if(s.over){initFlappy();return;}s.started=true;s.bird.vy=-7;}
function flappyLoop(){
  const s=gameState;if(!s||s.over){return;}
  const c=document.getElementById('flappy-canvas');if(!c)return;
  const ctx=c.getContext('2d');const{W,H,gap,bird}=s;
  s.frame++;
  if(s.started){
    bird.vy+=0.35;bird.y+=bird.vy;
    if(s.frame%80===0)s.pipes.push({x:W,top:60+Math.random()*(H-gap-120)});
    s.pipes=s.pipes.filter(p=>p.x>-60);
    s.pipes.forEach(p=>{p.x-=3;if(p.x===60)s.score++;});
    // Collision
    if(bird.y<0||bird.y>H-20){s.over=true;const isNewF=setHighScore('flappy',s.score);setStatus(`💀 Thua rồi! Điểm: ${s.score}${isNewF?' 🏆 Kỷ lục mới!':''}`,'var(--pink)');return;}
    for(const p of s.pipes){
      if(bird.y<p.top||bird.y>p.top+gap)if(Math.abs((p.x+25)-70)<22){s.over=true;const isNewF2=setHighScore('flappy',s.score);setStatus(`💥 Crash! Điểm: ${s.score}${isNewF2?' 🏆 Kỷ lục!':''}`,'var(--pink)');return;}
    }
  }
  // Draw
  ctx.fillStyle='#03040a';ctx.fillRect(0,0,W,H);
  // Stars
  ctx.fillStyle='rgba(0,245,212,.3)';
  for(let i=0;i<20;i++){const x=(i*137+s.frame)%W,y=(i*79)%H;ctx.fillRect(x,y,1,1);}
  // Pipes
  s.pipes.forEach(p=>{
    const g=ctx.createLinearGradient(p.x,0,p.x+50,0);g.addColorStop(0,'rgba(168,85,247,.6)');g.addColorStop(1,'rgba(0,245,212,.4)');ctx.fillStyle=g;
    ctx.fillRect(p.x,0,50,p.top);ctx.fillRect(p.x,p.top+gap,50,H);
    ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(p.x-5,p.top-12,60,12);ctx.fillRect(p.x-5,p.top+gap,60,12);
  });
  // Bird
  const bx=70;
  ctx.save();ctx.translate(bx,bird.y);ctx.rotate(Math.min(Math.max(bird.vy*0.08,-0.5),0.5));
  ctx.fillStyle='#f72585';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(5,-3,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#03040a';ctx.beginPath();ctx.arc(6,-3,2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ff6b35';ctx.fillRect(10,-3,10,5);ctx.restore();
  // Score
  ctx.fillStyle='rgba(0,245,212,.9)';ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.fillText(s.score,W/2,36);ctx.textAlign='left';
  if(!s.started){ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='14px monospace';ctx.textAlign='center';ctx.fillText('Nhấp hoặc phím Cách để bắt đầu',W/2,H/2+40);ctx.textAlign='left';}
  if(!document.hidden) s.flappyRAF=requestAnimationFrame(flappyLoop);
}

// ==================================
// SIMON SAYS
// ==================================
function initSimon(){
  if(typeof gameState !== 'undefined' && gameState.simonInterval) {
    clearInterval(gameState.simonInterval); 
  }
  gameState={sequence:[],player:[],level:0,playing:false,over:false,simonInterval:null};
  document.getElementById('scoreboard').style.display='none';
  setStatus('Nhớ và lặp lại chuỗi màu sắc 🎵');
  renderSimon();
  setTimeout(simonNextLevel,800);
}
function renderSimon(active=-1){
  const s=gameState;
  document.getElementById('gameBoard').innerHTML=`
  <div class="simon-wrap">
    <div class="simon-level">Vòng ${s.level}</div>
    <div style="font-family:var(--mono);font-size:.65rem;color:var(--muted);margin-bottom:4px">${s.playing?'Đang hiển thị...':'Lặp lại chuỗi!'}</div>
    <div class="simon-board">
      ${['🟢','🔵','🟠','🔴'].map((em,i)=>`<div class="simon-btn s${i} ${active===i?'lit':''}" id="sb${i}" onclick="simonPress(${i})">${em}</div>`).join('')}
    </div>
  </div>`;
}
function simonNextLevel(){
  const s=gameState;s.level++;s.player=[];
  s.sequence.push(Math.floor(Math.random()*4));
  setStatus(`Vòng ${s.level} — Quan sát chuỗi ${s.sequence.length} bước`);
  s.playing=true;renderSimon();
  let i=0;
  if(s.simonInterval) clearInterval(s.simonInterval);
  s.simonInterval=setInterval(()=>{
    if(i>0){const prev=document.getElementById('sb'+(s.sequence[i-1]));if(prev)prev.classList.remove('lit');}
    if(i>=s.sequence.length){clearInterval(s.simonInterval);s.simonInterval=null;s.playing=false;setStatus('Đến lượt bạn! Nhấp theo thứ tự.');renderSimon();return;}
    renderSimon(s.sequence[i]);i++;
  },700);
}
function simonPress(btn){
  const s=gameState;if(s.playing||s.over)return;
  document.getElementById('sb'+btn)?.classList.add('lit');
  setTimeout(()=>document.getElementById('sb'+btn)?.classList.remove('lit'),200);
  s.player.push(btn);
  const idx=s.player.length-1;
  if(s.player[idx]!==s.sequence[idx]){
    s.over=true;setStatus(`❌ Sai rồi! Dừng ở vòng ${s.level}`,'var(--pink)');return;
  }
  if(s.player.length===s.sequence.length){
    setStatus(`✅ Đúng! Vòng ${s.level} hoàn thành!`,'var(--green)');
    setTimeout(simonNextLevel,900);
  }
}

// ==================================
// CHESS (simplified)
// ==================================
const CHESS_PIECES={
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
};
function initChess(){
  const board=[
    ['bR','bN','bB','bQ','bK','bB','bN','bR'],
    ['bP','bP','bP','bP','bP','bP','bP','bP'],
    Array(8).fill(null),Array(8).fill(null),Array(8).fill(null),Array(8).fill(null),
    ['wP','wP','wP','wP','wP','wP','wP','wP'],
    ['wR','wN','wB','wQ','wK','wB','wN','wR'],
  ];
  gameState={board,turn:'w',selected:null,legal:[],over:false,history:[],check:false};
  document.getElementById('scoreboard').style.display='none';
  setStatus('Cờ Vua — Nhấp chọn quân, nhấp đích để đi ♟️');
  renderChess();
}
function chessClick(r,c){
  const s=gameState;if(s.over)return;
  if(s.selected){
    if(s.legal.some(m=>m[0]===r&&m[1]===c)){
      chessMove(s.selected,r,c);return;
    }
    if(s.board[r][c]&&s.board[r][c][0]===s.turn){s.selected=[r,c];s.legal=chessLegal(r,c);renderChess();return;}
    s.selected=null;s.legal=[];renderChess();return;
  }
  if(s.board[r][c]&&s.board[r][c][0]===s.turn){s.selected=[r,c];s.legal=chessLegal(r,c);renderChess();}
}
function chessMove(from,tr,tc){
  const s=gameState;const [fr,fc]=from;
  const piece=s.board[fr][fc];const taken=s.board[tr][tc];
  s.board[tr][tc]=piece;s.board[fr][fc]=null;
  // Pawn promotion
  if(piece==='wP'&&tr===0)s.board[tr][tc]='wQ';
  if(piece==='bP'&&tr===7)s.board[tr][tc]='bQ';
  s.history.push({from,to:[tr,tc],piece,taken});
  if(taken&&taken[1]==='K'){s.over=true;setStatus(`🏆 Bạn thắng! Chiếu hết!`,'var(--cyan)');s.selected=null;s.legal=[];renderChess();return;}
  s.turn=s.turn==='w'?'b':'w';s.selected=null;s.legal=[];
  renderChess();
  if(s.turn==='b'&&getMode()==='vs-ai'){setTimeout(chessAI,350);}
}
function chessLegal(r,c){
  const s=gameState;const p=s.board[r][c];if(!p)return[];
  const moves=[];const color=p[0];const type=p[1];
  const opp=color==='w'?'b':'w';
  const add=(tr,tc)=>{if(tr>=0&&tr<8&&tc>=0&&tc<8&&(!s.board[tr][tc]||s.board[tr][tc][0]===opp))moves.push([tr,tc]);};
  const slide=(dr,dc)=>{let nr=r+dr,nc=c+dc;while(nr>=0&&nr<8&&nc>=0&&nc<8){if(s.board[nr][nc]){if(s.board[nr][nc][0]===opp)moves.push([nr,nc]);break;}moves.push([nr,nc]);nr+=dr;nc+=dc;}};
  if(type==='P'){const dir=color==='w'?-1:1;const start=color==='w'?6:1;
    if(r+dir>=0&&r+dir<8&&!s.board[r+dir][c])moves.push([r+dir,c]);
    if(r===start&&!s.board[r+dir][c]&&!s.board[r+2*dir][c])moves.push([r+2*dir,c]);
    [[r+dir,c-1],[r+dir,c+1]].forEach(([tr,tc])=>{if(tr>=0&&tr<8&&tc>=0&&tc<8&&s.board[tr][tc]&&s.board[tr][tc][0]===opp)moves.push([tr,tc]);});}
  if(type==='N'){[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc));}
  if(type==='B'||type==='Q'){[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc));}
  if(type==='R'||type==='Q'){[[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));}
  if(type==='K'){[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c+dc));}
  return moves;
}
function chessAI(){
  const s=gameState;if(s.over||s.turn!=='b')return;
  const lv=getLevel();const moves=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    if(s.board[r][c]&&s.board[r][c][0]==='b'){
      chessLegal(r,c).forEach(([tr,tc])=>moves.push({from:[r,c],to:[tr,tc],score:chessScore(tr,tc,lv)}));
    }
  }
  if(!moves.length){s.over=true;setStatus('🏆 Bạn thắng! Máy hết nước đi!','var(--cyan)');return;}
  moves.sort((a,b)=>b.score-a.score);
  const pick=lv===0?moves[Math.floor(Math.random()*moves.length)]:lv===1?moves[Math.floor(Math.random()*Math.min(3,moves.length))]:moves[0];
  chessMove(pick.from,pick.to[0],pick.to[1]);
}
function chessScore(r,c,lv){
  const s=gameState;const scores={P:1,N:3,B:3,R:5,Q:9,K:100};
  let sc=s.board[r][c]?scores[s.board[r][c][1]]||0:0;
  if(lv>=2)sc+=(Math.abs(r-3.5)+Math.abs(c-3.5)<3)?0.5:0;
  return sc+Math.random()*0.5;
}
function renderChess(){
  const s=gameState;const files=['a','b','c','d','e','f','g','h'];
  let cells='';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const light=(r+c)%2===0;const p=s.board[r][c];
    const isSel=s.selected&&s.selected[0]===r&&s.selected[1]===c;
    const isLegal=s.legal.some(m=>m[0]===r&&m[1]===c);
    cells+=`<div class="chess-cell ${light?'light':'dark'} ${isSel?'selected':''} ${isLegal?'legal':''}" onclick="chessClick(${r},${c})">${p?CHESS_PIECES[p]:''}</div>`;
  }
  const labels=files.map(f=>`<div class="chess-label">${f}</div>`).join('');
  document.getElementById('gameBoard').innerHTML=`
    <div style="width:100%;max-width:600px;margin:0 auto;">
      <div class="chess-board">${cells}</div>
      <div class="chess-label-row">${labels}</div>
      <div style="text-align:center;margin-top:8px;font-family:var(--mono);font-size:.68rem;color:var(--muted)">
        ${s.turn==='w'?'⬜ Lượt bạn (quân trắng)':'⬛ Máy đang suy nghĩ...'}
      </div>
    </div>`;
}


// ==================================================
// CỜ TƯỚNG (Chinese Chess / Xiangqi)
// ==================================================

// Piece codes: r=red(bottom/player), b=black(top/AI)
// Types: K=King/Tướng, A=Advisor/Sĩ, E=Elephant/Tượng,
//        H=Horse/Mã, R=Rook/Xe, C=Cannon/Pháo, P=Pawn/Tốt

const CT_PIECES = {
  rK:'將', bK:'帥',
  rA:'士', bA:'仕',
  rE:'象', bE:'相',
  rH:'馬', bH:'傌',
  rR:'車', bR:'俥',
  rC:'砲', bC:'炮',
  rP:'卒', bP:'兵'
};

// Vietnamese piece names
const CT_NAMES = {
  K:'Tướng', A:'Sĩ', E:'Tượng', H:'Mã', R:'Xe', C:'Pháo', P:'Tốt'
};

// Piece values for AI
const CT_VALUES = { K:10000, A:120, E:120, H:270, R:600, C:285, P:30 };

// Center bonus for pieces
const CT_POS_BONUS = {
  H: [[0,0,0,0,0,0,0,0,0],[0,1,2,3,2,3,2,1,0],[0,2,4,6,4,6,4,2,0],
      [2,4,8,8,8,8,8,4,2],[2,4,8,8,8,8,8,4,2],[2,4,8,8,8,8,8,4,2],
      [0,2,4,6,4,6,4,2,0],[0,1,2,3,2,3,2,1,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]],
};

function initCoTuong() {
  // 10 rows x 9 cols board
  const board = Array(10).fill(null).map(() => Array(9).fill(null));
  // Black pieces (top, rows 0-4)
  board[0] = ['bR','bH','bE','bA','bK','bA','bE','bH','bR'];
  board[2][1]='bC'; board[2][7]='bC';
  [0,2,4,6,8].forEach(c => board[3][c]='bP');
  // Red pieces (bottom, rows 5-9)
  [0,2,4,6,8].forEach(c => board[6][c]='rP');
  board[7][1]='rC'; board[7][7]='rC';
  board[9] = ['rR','rH','rE','rA','rK','rA','rE','rH','rR'];

  gameState = {
    board, turn:'r', selected:null, legal:[],
    over:false, history:[], check:false,
    scores:{r:0,b:0}
  };
  document.getElementById('scoreboard').style.display='none';
  setStatus('Cờ Tướng — Nhấp quân đỏ để chọn, nhấp đích để đi 🔴');
  renderCoTuong();
}

function ctClick(r, c) {
  const s = gameState; if(s.over) return;
  const piece = s.board[r][c];

  if(s.selected) {
    // Try to move
    if(s.legal.some(m => m[0]===r && m[1]===c)) {
      ctMove(s.selected, r, c);
      return;
    }
    // Reselect own piece
    if(piece && piece[0] === s.turn) {
      s.selected = [r,c];
      s.legal = ctGetLegal(r, c);
      renderCoTuong(); return;
    }
    s.selected = null; s.legal = [];
    renderCoTuong(); return;
  }
  if(piece && piece[0] === s.turn) {
    s.selected = [r,c]; s.legal = ctGetLegal(r,c);
    renderCoTuong();
  }
}

function ctMove(from, tr, tc) {
  const s = gameState;
  const [fr, fc] = from;
  const piece = s.board[fr][fc];
  const taken = s.board[tr][tc];

  s.board[tr][tc] = piece;
  s.board[fr][fc] = null;
  s.history.push({from, to:[tr,tc], piece, taken});
  s.selected = null; s.legal = [];

  if(taken) {
    if(taken[1]==='K') {
      s.over=true;
      const winner = s.turn==='r' ? '🔴 Đỏ (Bạn)' : '⚫ Đen (Máy)';
      setStatus(`🏆 ${winner} thắng! Chiếu hết Tướng!`, s.turn==='r'?'var(--cyan)':'var(--pink)');
      renderCoTuong(); return;
    }
  }

  s.turn = s.turn==='r' ? 'b' : 'r';
  renderCoTuong();

  if(s.turn==='b' && getMode()==='vs-ai') {
    setTimeout(ctAI, 400);
  }
}

// -- LEGAL MOVES --
function ctGetLegal(r, c) {
  const s = gameState;
  const piece = s.board[r][c];
  if(!piece) return [];
  const color = piece[0], type = piece[1];
  const moves = [];

  const inBoard = (r,c) => r>=0&&r<10&&c>=0&&c<9;
  const isEmpty = (r,c) => inBoard(r,c) && !s.board[r][c];
  const isEnemy = (r,c) => inBoard(r,c) && s.board[r][c] && s.board[r][c][0]!==color;
  const isOwn = (r,c) => inBoard(r,c) && s.board[r][c] && s.board[r][c][0]===color;
  const canLand = (r,c) => inBoard(r,c) && !isOwn(r,c);
  const palace = (color==='r') ? {r1:7,r2:9,c1:3,c2:5} : {r1:0,r2:2,c1:3,c2:5};
  const inPalace = (r,c,col) => {
    const p = col==='r' ? {r1:7,r2:9,c1:3,c2:5} : {r1:0,r2:2,c1:3,c2:5};
    return r>=p.r1&&r<=p.r2&&c>=p.c1&&c<=p.c2;
  };
  const ownSide = (r,col) => col==='r' ? r>=5 : r<=4;

  if(type==='K') { // Tướng: 1 ô trong cung
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
      const nr=r+dr,nc=c+dc;
      if(inPalace(nr,nc,color)&&canLand(nr,nc)) moves.push([nr,nc]);
    });
    // Tướng đối mặt (flying general)
  }

  if(type==='A') { // Sĩ: chéo trong cung
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>{
      const nr=r+dr,nc=c+dc;
      if(inPalace(nr,nc,color)&&canLand(nr,nc)) moves.push([nr,nc]);
    });
  }

  if(type==='E') { // Tượng: 2 ô chéo, không qua sông
    [[-2,-2],[-2,2],[2,-2],[2,2]].forEach(([dr,dc])=>{
      const nr=r+dr,nc=c+dc;
      const mr=r+dr/2,mc=c+dc/2;
      if(inBoard(nr,nc) && ownSide(nr,color) && !s.board[mr][mc] && canLand(nr,nc))
        moves.push([nr,nc]);
    });
  }

  if(type==='H') { // Mã: L-shape, bị chặn
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
      const mr=r+dr,mc=c+dc;
      if(!inBoard(mr,mc)||s.board[mr][mc]) return;
      const legs = dr===0 ? [[-1,dc<0?-1:1],[1,dc<0?-1:1]] : [[dr,dc===0?-1:dc<0?-1:1],[dr,dc===0?1:dc<0?-1:1]];
      // Fix: perp directions
      const perps = dr!==0 ? [[mr+1,mc],[mr-1,mc]] : [[mr,mc+1],[mr,mc-1]];
      // Simplified: just 2 diagonal steps from the mid
      const finals = dr!==0 ? [[mr+dr,mc-1],[mr+dr,mc+1]] : [[mr-1,mc+dc],[mr+1,mc+dc]];
      finals.forEach(([nr,nc])=>{if(canLand(nr,nc))moves.push([nr,nc]);});
    });
  }

  if(type==='R') { // Xe: thẳng không giới hạn
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
      let nr=r+dr,nc=c+dc;
      while(inBoard(nr,nc)){
        if(s.board[nr][nc]){ if(isEnemy(nr,nc)) moves.push([nr,nc]); break; }
        moves.push([nr,nc]); nr+=dr; nc+=dc;
      }
    });
  }

  if(type==='C') { // Pháo: thẳng, ăn cần nhảy qua đúng 1 quân
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
      let nr=r+dr,nc=c+dc,jumped=false;
      while(inBoard(nr,nc)){
        if(!jumped){
          if(s.board[nr][nc]) jumped=true;
          else moves.push([nr,nc]);
        } else {
          if(s.board[nr][nc]){ if(isEnemy(nr,nc)) moves.push([nr,nc]); break; }
        }
        nr+=dr; nc+=dc;
      }
    });
  }

  if(type==='P') { // Tốt: tiến, qua sông thêm 2 hướng
    const fwd = color==='r' ? -1 : 1;
    const crossed = color==='r' ? r<=4 : r>=5;
    if(inBoard(r+fwd,c) && canLand(r+fwd,c)) moves.push([r+fwd,c]);
    if(crossed) {
      [[0,-1],[0,1]].forEach(([dr,dc])=>{
        if(canLand(r+dr,c+dc)) moves.push([r+dr,c+dc]);
      });
    }
  }

  return moves;
}

// -- AI --
function ctAI() {
  const s = gameState; if(s.over || s.turn!=='b') return;
  const lv = getLevel();
  const allMoves = [];

  for(let r=0;r<10;r++) for(let c=0;c<9;c++) {
    if(s.board[r][c]&&s.board[r][c][0]==='b') {
      ctGetLegal(r,c).forEach(([tr,tc])=>{
        const taken = s.board[tr][tc];
        let score = taken ? (CT_VALUES[taken[1]]||0) : 0;
        // Positional bonus
        if(lv>=2) {
          const pb = CT_POS_BONUS[s.board[r][c][1]];
          if(pb) score += pb[tr]?.[tc]||0;
          score += Math.random()*5;
        } else score += Math.random()*20;
        allMoves.push({from:[r,c], to:[tr,tc], score});
      });
    }
  }

  if(!allMoves.length) {
    s.over=true; setStatus('🏆 Bạn thắng! Máy hết nước đi!','var(--cyan)'); return;
  }

  allMoves.sort((a,b)=>b.score-a.score);
  const pool = lv===0 ? allMoves : lv===1 ? allMoves.slice(0,Math.ceil(allMoves.length*0.4)) : allMoves.slice(0,3);
  const pick = pool[Math.floor(Math.random()*pool.length)];
  ctMove(pick.from, pick.to[0], pick.to[1]);
}

// -- RENDER --
function renderCoTuong() {
  const s = gameState;
  // Count pieces
  const rPieces = [], bPieces = [];
  s.board.forEach(row=>row.forEach(p=>{if(p&&p[0]==='r')rPieces.push(p);if(p&&p[0]==='b')bPieces.push(p);}));

  let html = `
  <div style="overflow-x:auto;">
  <div style="width:100%;max-width:600px;margin:0 auto;">
    <div style="
      display:grid;grid-template-columns:repeat(9,1fr);
      background:linear-gradient(135deg,rgba(255,165,0,.08),rgba(255,80,0,.05));
      border:2px solid rgba(255,140,0,.35);border-radius:10px;
      padding:4px;gap:2px;position:relative;
    " id="ctBoard">`;

  for(let r=0;r<10;r++) {
    for(let c=0;c<9;c++) {
      const piece = s.board[r][c];
      const isSel = s.selected&&s.selected[0]===r&&s.selected[1]===c;
      const isLegal = s.legal.some(m=>m[0]===r&&m[1]===c);
      const isRiver = r===4||r===5;

      let cellBg = 'rgba(255,255,255,.03)';
      if(isRiver) cellBg = 'rgba(0,200,255,.04)';
      if(isSel) cellBg = 'rgba(0,245,212,.2)';
      if(isLegal) cellBg = piece ? 'rgba(247,37,133,.2)' : 'rgba(168,85,247,.15)';

      const borderCol = isSel ? 'var(--cyan)' : isLegal ? (piece?'var(--pink)':'rgba(168,85,247,.4)') : 'rgba(255,255,255,.06)';

      let pieceHtml = '';
      if(piece) {
        const isRed = piece[0]==='r';
        const char = CT_PIECES[piece]||'?';
        pieceHtml = `
          <div style="
            width:86%;height:86%;border-radius:50%;
            background:${isRed?'radial-gradient(circle at 35% 35%,#ff6b35,#cc2200)':'radial-gradient(circle at 35% 35%,#2a2a2a,#111)'};
            display:flex;align-items:center;justify-content:center;
            font-size:clamp(.7rem,2vw,1.2rem);font-weight:900;
            color:${isRed?'#ffe680':'#e8e8e8'};
            box-shadow:${isRed?'0 2px 8px rgba(255,80,0,.5),inset 0 1px 0 rgba(255,255,255,.2)':'0 2px 8px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)'};
            border:${isRed?'1.5px solid rgba(255,200,0,.5)':'1.5px solid rgba(255,255,255,.15)'};
            text-shadow:0 1px 2px rgba(0,0,0,.8);
            position:relative;z-index:1;
            transition:transform .15s;
          ">${char}</div>`;
      } else if(isLegal) {
        pieceHtml = `<div style="width:30%;height:30%;border-radius:50%;background:rgba(168,85,247,.5);box-shadow:0 0 8px rgba(168,85,247,.4);"></div>`;
      }

      // Palace lines visual (draw X in palace cells)
      const inRPalace = r>=7&&r<=9&&c>=3&&c<=5;
      const inBPalace = r>=0&&r<=2&&c>=3&&c<=5;

      html += `
        <div onclick="ctClick(${r},${c})" style="
          aspect-ratio:1;display:flex;align-items:center;justify-content:center;
          background:${cellBg};border:1px solid ${borderCol};
          border-radius:4px;cursor:none;transition:all .15s;
          position:relative;
          ${isRiver&&r===4?'border-bottom:1px dashed rgba(0,200,255,.3);':''}
          ${isRiver&&r===5?'border-top:1px dashed rgba(0,200,255,.3);':''}
        ">
          ${(inRPalace||inBPalace)&&!piece?`<div style="position:absolute;inset:0;opacity:.15;background:radial-gradient(circle,rgba(255,200,0,.3),transparent 70%)"></div>`:''}
          ${pieceHtml}
        </div>`;
    }
    // River label
    if(r===4) {
      html += `</div>
        <div style="text-align:center;padding:3px;font-family:var(--mono);font-size:.6rem;color:rgba(0,200,255,.5);letter-spacing:.2em;background:rgba(0,200,255,.03);border-left:2px solid rgba(255,140,0,.35);border-right:2px solid rgba(255,140,0,.35);">
          -- 楚 河 ------------ 漢 界 --
        </div>
        <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:2px;">`;
    }
  }

  html += `</div>

  <!-- Captured pieces -->
  <div style="display:flex;justify-content:space-between;margin-top:10px;padding:0 2px;">
    <div style="font-family:var(--mono);font-size:.62rem;color:var(--muted)">
      ⚫ ${bPieces.length} quân còn
    </div>
    <div style="font-family:var(--mono);font-size:.62rem;color:var(--muted)">
      ${s.turn==='r'?'🔴 Lượt của bạn':'⚫ Máy đang suy nghĩ...'}
    </div>
    <div style="font-family:var(--mono);font-size:.62rem;color:var(--muted)">
      🔴 ${rPieces.length} quân còn
    </div>
  </div>

  <!-- Piece legend -->
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;justify-content:center;">
    ${Object.entries(CT_NAMES).map(([k,v])=>`
      <span style="font-family:var(--mono);font-size:.6rem;color:var(--muted);background:rgba(255,255,border:1px solid var(--border);padding:2px 7px;border-radius:4px;">
        ${CT_PIECES['r'+k]} = ${v}
      </span>`).join('')}
  </div>
  </div>`;
}




// ==========================================
// BLOG SEARCH & FILTER
// ==========================================
let blogFilter = 'all';

function setFilter(cat, el) {
  blogFilter = cat;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
  filterBlog();
}

function filterBlog() {
  const q = (document.getElementById('blogSearch')?.value || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#blogGrid .blog-card');
  let visible = 0;
  cards.forEach(card => {
    const title = card.querySelector('.btitle')?.textContent.toLowerCase() || '';
    const excerpt = card.querySelector('.bexcerpt')?.textContent.toLowerCase() || '';
    const cat = card.querySelector('.bcat')?.textContent.trim() || '';
    const matchQ = !q || title.includes(q) || excerpt.includes(q);
    const matchCat = blogFilter === 'all' || cat === blogFilter;
    const show = matchQ && matchCat;
    card.style.display = show ? '' : 'none';
    if(show) visible++;
  });
  const countEl = document.getElementById('searchCount');
  if(countEl) {
    countEl.textContent = (q || blogFilter !== 'all') ? `Hiển thị ${visible} bài viết` : '';
  }
  let noRes = document.getElementById('noResults');
  if(visible === 0) {
    if(!noRes) {
      noRes = document.createElement('div');
      noRes.id = 'noResults';
      noRes.className = 'no-results';
      noRes.innerHTML = '<span class="no-results-icon">🔍</span>Không tìm thấy bài viết nào';
      const grid = document.getElementById('blogGrid');
      if(grid) grid.after(noRes);
    }
    noRes.style.display = '';
  } else if(noRes) {
    noRes.style.display = 'none';
  }
}

// ==========================================
// READING PROGRESS BAR
// ==========================================
const progressBar = document.getElementById('readingProgress');
window.addEventListener('scroll', () => {
  if(!progressBar) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? scrollTop / docHeight : 0;
  progressBar.style.transform = `scaleX(${progress})`;
  progressBar.style.display = 'block';
}, { passive: true });

// Progress trong modal
document.addEventListener('click', () => {
  const modalBox = document.querySelector('.modal-box');
  if(!modalBox) return;
  modalBox.addEventListener('scroll', () => {
    if(!progressBar) return;
    const scrollTop = modalBox.scrollTop;
    const scrollHeight = modalBox.scrollHeight - modalBox.clientHeight;
    const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    progressBar.style.transform = `scaleX(${progress})`;
    progressBar.style.display = 'block';
  }, { passive: true, once: false });
});

// ==========================================
// PWA INSTALL
// ==========================================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if(!localStorage.getItem('pwa-dismissed')) {
    setTimeout(() => {
      const banner = document.getElementById('pwa-banner');
      if(banner) banner.classList.add('show');
    }, 30000);
  }
});
function installPWA() {
  const banner = document.getElementById('pwa-banner');
  if(banner) banner.classList.remove('show');
  if(deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  }
}
function dismissPWA() {
  const banner = document.getElementById('pwa-banner');
  if(banner) banner.classList.remove('show');
  localStorage.setItem('pwa-dismissed', '1');
}



// ===========================================================

// ==========================================
// GAME HIGH SCORES
// ==========================================
const HS_KEYS = {snake:'hs_snake',flappy:'hs_flappy',reaction:'hs_react'};
function getHighScore(game){return parseInt(localStorage.getItem(HS_KEYS[game]||'hs_'+game)||'0');}
function setHighScore(game,val){const prev=getHighScore(game);if(val>prev){localStorage.setItem(HS_KEYS[game]||'hs_'+game,val);return true;}return false;}

// ============================================
// TYPEWRITER EFFECT
// ============================================
(function startTypewriter() {
  function run() {
    const el = document.getElementById('typewriterEl');
    if(!el) { setTimeout(run, 200); return; }
    const roles = ['Full-Stack Developer', 'Product Builder', 'AI Enthusiast', 'Software Engineer', 'Side Project Creator'];
    let ri = 0, ci = 0, deleting = false, timer;
    function tick() {
      const role = roles[ri];
      if(!deleting) {
        el.textContent = role.slice(0, ++ci);
        if(ci === role.length) { deleting = true; timer = setTimeout(tick, 1800); return; }
      } else {
        el.textContent = role.slice(0, --ci);
        if(ci === 0) { deleting = false; ri = (ri + 1) % roles.length; timer = setTimeout(tick, 300); return; }
      }
      timer = setTimeout(tick, deleting ? 45 : 80);
    }
    setTimeout(tick, 600);
  }
  run();
})();

// Accessibility: div[role="button"] (blog-card, write-toggle, form-cancel) chỉ có onclick,
// không tự nhận Enter/Space như <button> thật — bắc cầu bàn phím qua click() thật.
document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter' && e.key !== ' ') return;
  var el = e.target.closest('[role="button"]');
  if(!el) return;
  e.preventDefault();
  el.click();
});

// Init — PHẢI đứng sau mọi khai báo let/const ở trên (đặc biệt "let gameState"),
// không được đặt ở đầu file. showPage() đọc gameState ngay khi gọi; với let/const,
// toàn bộ file được hoist vào Temporal Dead Zone ngay khi script bắt đầu chạy, nên
// gọi showPage() trước dòng "let gameState = {}" ném "Cannot access 'gameState'
// before initialization" — lỗi này chặn đứng toàn bộ phần code phía sau chạy tiếp
// (kể cả gán "const ALL=[...]" và listener keydown accessibility phía trên), nên
// modal blog, chuyển ngôn ngữ, và phím tắt a11y sẽ hỏng dây chuyền theo.
showPage('home');
