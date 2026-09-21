/* SAMPLE DATA - only used when WEB_APP_URL in config.js is blank.
   Everything here is made up so you can preview the design. Dates are built around
   today's real date so the page always looks "live". Safe to delete once you go live. */
(function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isWeekday(d) { var x = d.getDay(); return x !== 0 && x !== 6; }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function seg(text, url) { return { text: text, url: url || null }; }

  var TOPICS = {
    algebra1: ['Variables and Expressions', 'Commutative and Associative Properties', 'Terms and Factors', 'Distribute Using the Area Model',
      'Equivalent Expressions', 'One-Step Equations', 'Two-Step Equations', 'Equations with Variables on Both Sides',
      'Literal Equations', 'Writing Equations from Words', 'Inequalities on a Number Line', 'Solving Inequalities'],
    math8: ['Integer Operations Review', 'Exponent Rules', 'Scientific Notation', 'Square Roots and Cube Roots',
      'Rational and Irrational Numbers', 'Estimating Irrational Numbers', 'Solving One-Step Equations', 'Multi-Step Equations',
      'Variables on Both Sides', 'Number of Solutions', 'Slope as a Rate of Change', 'Graphing Proportional Relationships']
  };
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function lessons(classKey) {
    var now = new Date();
    var todayKey = key(now);
    var dates = [];
    var d = addDays(now, -1);
    while (dates.length < 11) { if (isWeekday(d) && key(d) !== todayKey) dates.unshift(new Date(d.getTime())); d = addDays(d, -1); }
    var future = [];
    d = addDays(now, 1);
    while (future.length < 3) { if (isWeekday(d)) future.push(new Date(d.getTime())); d = addDays(d, 1); }
    var seq = dates.slice();
    if (isWeekday(now)) seq.push(new Date(now.getTime()));
    seq = seq.concat(future);

    var topics = TOPICS[classKey];
    var days = [];
    var nextIdx = seq.findIndex(function (x) { return key(x) > todayKey; });
    seq.forEach(function (dt, i) {
      var k = key(dt);
      var status = k < todayKey ? 'past' : k === todayKey ? 'today' : (i === nextIdx ? 'next' : (i === nextIdx + 2 ? 'upcomingQuiz' : null));
      if (!status) return;
      var quiz = (i % 6 === 4) || status === 'upcomingQuiz';
      var title = topics[i % topics.length] + (quiz ? ' QUIZ' : '');
      var hasKeys = status === 'past' ? (i % 2 === 0) : (status === 'today' || status === 'next');
      var released = status === 'past';
      var release = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1, 12, 0, 0);   // about 8am ET
      days.push({
        date: k,
        letterDay: LETTERS[i % 6],
        status: status,
        isQuiz: quiz,
        fields: {
          lesson: [seg(title)],
          classwork: [seg('Notes, slides ' + (1 + i * 3) + '-' + (3 + i * 3) + ' ', 'https://example.com/slides'), seg('\nPractice set ' + (i + 1), 'https://example.com/practice')],
          assignment: [seg('Homework pgs ' + (10 + i * 2) + '-' + (11 + i * 2) + ' ', 'https://example.com/hw'), seg('(skip #6)')],
          answerKeys: (hasKeys && released) ? [seg('Answer key ' + (i + 1), 'https://example.com/key')] : [],
          mathReminders: (i % 4 === 1 || status === 'today') ? [seg('Bring your notebook and a charged Chromebook.')] : [],
          schoolReminders: (i % 5 === 2 || status === 'next') ? [seg('Picture retake day. Look sharp!')] : []
        },
        answerKeys: { hasKeys: hasKeys, released: released, releaseAt: release.toISOString() }
      });
    });
    return { ok: true, class: classKey, className: classKey === 'math8' ? 'Math 8' : 'Algebra 1', generatedAt: new Date().toISOString(), today: todayKey, days: days };
  }

  function banner(title, color) {
    var t = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100" viewBox="0 0 400 100">' +
      '<rect width="400" height="100" rx="10" fill="' + color + '"/>' +
      '<text x="200" y="62" font-family="Arial, sans-serif" font-size="' + (t.length > 16 ? 22 : 34) + '" font-weight="700" text-anchor="middle" fill="#ffffff">' + t + '</text></svg>';
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }
  function item(title, desc, color, icon, tag) {
    return { title: title, url: 'https://example.com/' + encodeURIComponent(title), description: desc, image: color ? banner(title, color) : null, icon: icon, tag: tag || '' };
  }

  function links(classKey) {
    var essentials = [
      item('DeltaMath', 'Online practice and assignments', '#2b6cb0', '\uD83D\uDCD0'),
      classKey === 'math8' ? item('8th Grade Homework Slide', 'Where homework is posted', '#805ad5', '\uD83D\uDCDD') : item('eMathInstruction', 'Algebra 1 lessons and homework', '#c05621', '\uD83D\uDCD8'),
      item('Desmos Graphing Calculator', 'Free online graphing calculator', '#2f855a', '\uD83D\uDCC8'),
      item('Desmos: Scientific Calculator', 'A scientific calculator', '#2c7a7b', '\uD83E\uDDEE')
    ];
    var projects = [
      item('GraFables', 'Turn your own motion into graphs', '#0f1117', '\uD83C\uDFAC', 'Project'),
      item('Rational vs. Irrational', 'Sort numbers into the right category', '#d53f8c', '\uD83D\uDD22', 'Game'),
      classKey === 'algebra1' ? item('Regents Prep', 'Practice packets and score tracking', '#b7791f', '\uD83C\uDF93', 'Practice') : item('Integer Wars', '', null, '\u2694\uFE0F', 'Game')
    ];
    return { ok: true, class: classKey, className: classKey === 'math8' ? 'Math 8' : 'Algebra 1', generatedAt: new Date().toISOString(),
      sections: [{ name: 'Essentials', items: essentials }, { name: 'Games & Projects', items: projects }] };
  }

  window.SAMPLE_FEEDS = { lessons: lessons, links: links };
})();
