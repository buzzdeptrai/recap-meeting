/* Sample data, October 2026. All prices are examples ("ví dụ"). */
(function(){
  var DG=[1.34,3.49,0,0,1.65,2.35,3.18,1.91,2.54,0,0,1.07,3.22,2.88,2.07,3.03,1.11,0,0.8,1.74,2.1,2.11];
  var OP=[0.17,0.31,0.22,0,0.11,0.26,0.36,0.33,0.29,0.16,0,0.07,0.28,0.39,0.32,0.33,0.27,0.07,0.05,0.16,0.25,0.25];
  var GE=[0.02,0.06,0,0,0.03,0.03,0.05,0.04,0.05,0,0,0.02,0.06,0.05,0.03,0.06,0.02,0,0.01,0.03,0.03,0.04];
  var MEET=[2,3,0,0,2,3,3,2,3,0,0,1,3,3,2,3,1,0,1,2,2,2];
  function mul(a,k){return a.map(function(v){return v*k;});}
  // atom = smallest billable unit. totals are the month totals (22 days).
  var ATOMS=[
    {id:'dgLive',vendor:'Deepgram',model:'nova-3 · trực tiếp',service:'Chép lời trực tiếp',cost:mul(DG,31.65/36.59),tot:{cost:31.65,sec:246600,tin:0,tout:0,calls:47},note:'4.110 phút kênh'},
    {id:'dgBatch',vendor:'Deepgram',model:'nova-3 · chép lại',service:'Chép lại sau họp',cost:mul(DG,4.94/36.59),tot:{cost:4.94,sec:38520,tin:0,tout:0,calls:14},note:'642 phút kênh'},
    {id:'oai41',vendor:'OpenAI',model:'gpt-4.1',service:'Tạo biên bản',cost:mul(OP,4.30/4.65),tot:{cost:4.30,sec:0,tin:1310000,tout:210000,calls:46},note:'tạo biên bản'},
    {id:'gem',vendor:'Gemini',model:'gemini-3.1-flash-lite',service:'Dịch trực tiếp',cost:GE.slice(),tot:{cost:0.63,sec:0,tin:3840000,tout:620000,calls:5210},note:'dịch trực tiếp (chính)'},
    {id:'oaiMini',vendor:'OpenAI',model:'gpt-4.1-mini',service:'Dịch trực tiếp',cost:mul(OP,0.35/4.65),tot:{cost:0.35,sec:0,tin:520000,tout:90000,calls:177},note:'dịch dự phòng'}
  ];
  ATOMS.forEach(function(a){
    var ct=a.cost.reduce(function(s,v){return s+v;},0);
    a.day={};
    ['cost','sec','tin','tout','calls'].forEach(function(m){
      a.day[m]=a.cost.map(function(c){return m==='cost'?c:(ct?a.tot[m]*c/ct:0);});
    });
  });
  window.BB={
    DAYS:22, MEET:MEET, ATOMS:ATOMS, BUDGET:60, RATE:25400,
    // previous-period totals for "Tháng này" (01–22/09, sample)
    PREV:{cost:36.12,sec:251400,tok:5520000,calls:4962,meet:32},
    DESC:{
      vendor:{Deepgram:'nova-3 · chép lời',OpenAI:'gpt-4.1, gpt-4.1-mini',Gemini:'flash-lite · dịch chính'}
    }
  };

  // 38 meetings that match the per-day counts above
  var P=[
    ['Rà soát hợp đồng cung ứng Q4','22','10:12','00:24:05','VI+EN → VI','rec',0,0],
    ['Họp chuẩn bị kế hoạch triển khai','22','08:30','01:07:42','VI → EN','done',1,1,'…chốt <m>kế hoạch triển khai</m> theo ba đợt, đợt đầu bắt đầu ngày 3/11…'],
    ['Họp giá quý 4 với nhà cung cấp','21','14:00','00:52:18','VI+EN → VI','done',1,1,'…giữ <m>giá</m> 345 nếu họ ký trong quý này; thanh toán trong 45 ngày…'],
    ['Đồng bộ roadmap sản phẩm Q1','21','09:00','01:31:10','VI → EN','done',1,1],
    ['Phỏng vấn ứng viên Backend','20','15:30','00:48:55','VI','done',0,0],
    ['Sprint review tuần 42','20','10:00','01:02:30','VI+EN → VI','done',1,1],
    ['Đào tạo quy trình mua hàng','19','13:30','01:48:00','VI','done',1,0],
    ['Họp khách hàng Hải Âu','17','14:30','01:15:20','VI+EN → VI','done',1,1,'…đề xuất gói hỗ trợ và <m>giá</m> gia hạn cho năm sau…'],
    ['Họp ngân sách marketing Q4','16','16:00','00:41:07','VI → EN','err',1,0],
    ['Rà soát backlog sprint 43','16','11:00','00:33:20','VI','done',1,1],
    ['Họp giao ban đầu tuần','16','08:30','00:25:10','VI','done',1,0],
    ['Họp nội bộ phòng vận hành','15','09:15','00:36:40','VI','done',1,1],
    ['Phỏng vấn ứng viên Thiết kế','15','15:00','00:44:12','VI','done',1,0],
    ['Kế hoạch bảo trì kho tháng 11','14','14:00','00:58:30','VI','done',1,1],
    ['Đối soát công nợ nhà cung cấp','14','10:30','00:47:05','VI+EN → VI','done',1,1],
    ['Họp giao ban đầu tuần','14','08:30','00:22:48','VI','done',1,0],
    ['Review thiết kế trang thanh toán','13','15:30','01:10:15','VI+EN → VI','done',1,1],
    ['Họp đối tác logistics','13','11:00','00:39:50','VI → EN','done',1,1],
    ['Cập nhật tiến độ nhà máy','13','09:00','00:52:00','VI','done',1,0],
    ['Tổng kết tuần 41','12','16:00','00:35:25','VI','done',1,0],
    ['Họp ngân sách nhân sự 2027','9','14:00','01:05:40','VI','done',1,1],
    ['Thương lượng điều khoản bảo hành','9','10:00','00:49:30','VI+EN → VI','err',1,0],
    ['Họp giao ban đầu tuần','9','08:30','00:24:00','VI','done',1,0],
    ['Báo cáo chất lượng quý 3','8','15:00','01:12:10','VI','done',1,1],
    ['Họp khởi động dự án kho Bình Dương','8','09:30','01:20:00','VI+EN → VI','done',1,1],
    ['Tổng kết tuần 40','7','16:00','00:34:00','VI','done',1,0],
    ['Phỏng vấn ứng viên Kế toán','7','13:30','00:46:20','VI','done',1,0],
    ['Họp với đơn vị kiểm toán','7','09:00','01:25:35','VI+EN → VI','done',1,1],
    ['Rà soát rủi ro chuỗi cung ứng','6','14:30','00:57:45','VI → EN','done',1,1],
    ['Họp báo giá vận chuyển','6','10:30','00:43:10','VI','done',1,0],
    ['Họp giao ban đầu tuần','6','08:30','00:23:30','VI','done',1,0],
    ['Đào tạo công cụ quản lý đơn hàng','5','14:00','01:30:00','VI','done',1,0],
    ['Họp chiến lược thị trường miền Trung','5','09:30','01:00:50','VI+EN → VI','done',1,1],
    ['Rà soát danh mục nhà cung cấp','2','15:30','00:55:00','VI','done',1,0],
    ['Họp kế hoạch tuyển dụng Q4','2','11:00','00:38:45','VI','done',1,0],
    ['Họp giao ban đầu tuần','2','08:30','00:26:15','VI','done',1,0],
    ['Họp khởi động tháng 10','1','14:00','00:47:30','VI','done',1,1],
    ['Họp tổng kết tháng 9','1','09:00','01:18:20','VI+EN → VI','done',1,1]
  ];
  window.BB.MEETINGS=P.map(function(r,i){return {id:i,title:r[0],day:r[1],time:r[2],dur:r[3],lang:r[4],status:r[5],vi:!!r[6],en:!!r[7],snip:r[8]||''};});
  window.BB.GLOSSARY=[
    ['term sheet','EN','bản thoả thuận sơ bộ',false,'20/10'],['PO','EN','giữ nguyên',true,'20/10'],['SLA','EN','giữ nguyên',true,'18/10'],
    ['lead time','EN','thời gian giao hàng',false,'18/10'],['báo giá','VI','quotation',false,'15/10'],['đợt giao hàng','VI','delivery batch',false,'15/10'],
    ['Hải Âu','VI','giữ nguyên',true,'12/10'],['roadmap','EN','lộ trình sản phẩm',false,'09/10'],['backlog','EN','danh sách việc tồn',false,'09/10'],
    ['công nợ','VI','accounts payable',false,'07/10'],['sprint','EN','giữ nguyên',true,'07/10'],['đối soát','VI','reconciliation',false,'05/10'],
    ['MOQ','EN','số lượng đặt tối thiểu',false,'02/10'],['Bình Dương','VI','giữ nguyên',true,'01/10']
  ];
})();
