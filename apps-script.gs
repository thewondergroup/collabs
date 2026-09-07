/**
 * Wonder Collabs — Google Sheets backend
 * ---------------------------------------
 * 1. Create a Google Sheet called "Wonder Collabs".
 * 2. Extensions → Apps Script, paste this whole file, save.
 * 3. Run setup() once (authorise when asked). It creates the "Requests" tab with headers.
 * 4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Deploy.
 * 5. Copy the web-app URL into ENDPOINT at the bottom of index.html.
 * 6. In Apps Script: Triggers (clock icon) → Add trigger → onEditStatus, From spreadsheet, On edit.
 *
 * Workflow in the sheet:
 *   New requests land with Status = "Requested" and the creator gets an auto-reply.
 *   Type the options into "Dates offered" and set Status to "Dates sent" → they get an email asking them to pick one.
 *   When they reply, fill in "Confirmed date/time" (+ Details) and set Status to "Confirmed" → they get the confirmation email.
 *   Change Status to "Declined" → they get a polite no.
 */

const SHEET_NAME   = 'Requests';
const FROM_NAME    = 'The Wonder Agency';
const REPLY_TO     = 'hello@thewonder.group';
const NOTIFY       = 'hello@thewonder.group';   // internal ping for every new request (comma-separate for more)

const OPS = {
  tantrums: { title: 'Temper Tantrums opening night',            venue: 'Temper Tantrums, Wimpole Street' },
  temper:   { title: 'Bottomless brunch — Temper',               venue: 'Temper' },
  paradiso: { title: 'Bottomless brunch — Paradiso',             venue: 'Paradiso' },
  brix:     { title: 'BRIX LDN — dinner, brunch or Sunday roast', venue: 'BRIX LDN, London Bridge' },
  notto:    { title: 'Notto Piccadilly relaunch party',          venue: 'Notto Piccadilly' }
};

const HEADERS = [
  'Submitted', 'Status', 'Opportunity', 'Name', 'Email', 'Instagram', 'TikTok', 'Followers',
  'Venue', 'Service', 'Date 1', 'Date 2', 'Dietary', 'Content agreed', 'Notes',
  'Dates offered', 'Confirmed date/time', 'Details for guest', 'Owner', 'Confirmation sent', 'Content received', 'Op ID', 'Source'
];
const COL = {}; HEADERS.forEach((h, i) => COL[h] = i + 1);

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    sh.setColumnWidths(1, HEADERS.length, 140);
  }
  // Status dropdown + colours
  const statusRange = sh.getRange(2, COL['Status'], 1000);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Requested', 'Dates sent', 'Confirmed', 'Declined', 'Attended', 'Content received', 'No show'], true).build());
  const rules = [
    ['Requested', '#fff2cc'], ['Dates sent', '#d9ead3'], ['Confirmed', '#b6d7a8'],
    ['Declined', '#f4cccc'], ['Attended', '#cfe2f3'], ['Content received', '#d9d2e9'], ['No show', '#ead1dc']
  ].map(([v, c]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(v).setBackground(c).setRanges([statusRange]).build());
  sh.setConditionalFormatRules(rules);
}

/** Receives the form POST from the page. One row per invitation requested. */
function doPost(e) {
  const p = e.parameter || {};
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const ids = String(p.invitations || p.opportunity_id || '').split(',').map(s => s.trim()).filter(Boolean);
  const titles = [];

  ids.forEach(id => {
    const op = OPS[id] || { title: id, venue: '' };
    titles.push(op.title);
    const row = new Array(HEADERS.length).fill('');
    row[COL['Submitted'] - 1]      = new Date();
    row[COL['Status'] - 1]         = 'Requested';
    row[COL['Opportunity'] - 1]    = op.title;
    row[COL['Name'] - 1]           = p.name || '';
    row[COL['Email'] - 1]          = p.email || '';
    row[COL['Instagram'] - 1]      = p.instagram || '';
    row[COL['TikTok'] - 1]         = p.tiktok || '';
    row[COL['Followers'] - 1]      = p.followers || '';
    row[COL['Venue'] - 1]          = op.venue;
    row[COL['Service'] - 1]        = id === 'brix' ? (p.brix_service || '') : '';
    row[COL['Date 1'] - 1]         = p[id + '_date_1'] || '';
    row[COL['Date 2'] - 1]         = p[id + '_date_2'] || '';
    row[COL['Dietary'] - 1]        = p.dietary || '';
    row[COL['Content agreed'] - 1] = p.content || '';
    row[COL['Notes'] - 1]          = p.notes || '';
    row[COL['Op ID'] - 1]          = id;
    row[COL['Source'] - 1]         = p.source || '';
    sh.appendRow(row);
  });

  const list = '<ul>' + ids.map(id => {
    const op = OPS[id] || { title: id };
    const d1 = p[id + '_date_1'], d2 = p[id + '_date_2'], sv = id === 'brix' ? p.brix_service : '';
    return '<li><b>' + esc(op.title) + '</b>' + (sv ? ' — ' + esc(sv) : '') + (d1 ? ' — ' + esc(d1) + (d2 ? ' or ' + esc(d2) : '') : '') + '</li>';
  }).join('') + '</ul>';

  // auto-reply to the creator
  if (p.email) {
    MailApp.sendEmail({
      to: p.email, name: FROM_NAME, replyTo: REPLY_TO,
      subject: (ids.length > 1 ? 'We\'ve got your requests' : 'We\'ve got your request — ' + titles[0]),
      htmlBody: wrap(
        '<p>Hi ' + esc(first(p.name)) + ',</p>' +
        '<p>Thanks for requesting:</p>' + list +
        '<p>We\'re checking with each venue and will be back in touch within two working days to confirm your dates, or suggest some. Each invitation is confirmed separately.</p>' +
        '<p>Nothing is booked just yet, so please wait for our confirmation before contacting a venue or making any plans around it.</p>' +
        '<p>Speak soon,<br>The Wonder Agency</p>'
      )
    });
  }
  // internal ping
  if (NOTIFY) {
    MailApp.sendEmail({
      to: NOTIFY, name: 'Wonder Collabs', subject: 'New Wonder Collab request: ' + (p.name || '') + ' → ' + titles.join(', '),
      htmlBody: '<p>' + [
          ['Creator', p.name], ['Handle', [p.instagram, p.tiktok].filter(Boolean).join(' / ')], ['Followers', p.followers],
          ['Content', p.content], ['Dietaries', p.dietary], ['Notes', p.notes]
        ].filter(x => x[1]).map(x => '<b>' + x[0] + ':</b> ' + esc(x[1])).join('<br>') +
        '</p><p><b>Requested:</b></p>' + list + '<p><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">View request →</a></p>'
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

/** Installable on-edit trigger: emails the guest when Status becomes Confirmed or Declined. */
function onEditStatus(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEET_NAME || e.range.getColumn() !== COL['Status'] || e.range.getRow() < 2) return;
  const r = e.range.getRow();
  const status = e.value;
  const get = h => sh.getRange(r, COL[h]).getDisplayValue();
  const email = get('Email'); if (!email) return;
  const title = get('Opportunity');

  if (status === 'Confirmed') {
    if (get('Confirmation sent')) return;
    const when = get('Confirmed date/time');
    const details = get('Details for guest');
    if (!when) { SpreadsheetApp.getUi().alert('Add the confirmed date/time before setting Confirmed — no email sent.'); e.range.setValue('Dates sent'); return; }
    MailApp.sendEmail({
      to: email, name: FROM_NAME, replyTo: REPLY_TO,
      subject: 'You\'re in — ' + title,
      htmlBody: wrap(
        '<p>Hi ' + esc(first(get('Name'))) + ',</p>' +
        '<p>You\'re in! We\'re looking forward to having you at <b>' + esc(title) + '</b>.</p>' +
        '<p><b>When:</b> ' + esc(when) + '<br><b>Where:</b> ' + esc(get('Venue')) + (get('Service') ? ' — ' + esc(get('Service')) : '') +
        '<br><b>For:</b> you and a plus one</p>' +
        (details ? '<p><b>Your visit includes:</b><br>' + esc(details).replace(/\n/g, '<br>') + '</p>' : '') +
        '<p><b>Your content:</b><br>' + esc(get('Content agreed')) + '</p>' +
        '<p>Please tag the venue and @thewonderagency, and share the agreed content within 7 days of your visit.</p>' +
        '<p>If your plans change, just reply to this email as early as possible so we can let the venue know.</p>' +
        '<p>Enjoy!<br>The Wonder Agency</p>'
      )
    });
    sh.getRange(r, COL['Confirmation sent']).setValue(new Date());
  }

  if (status === 'Dates sent') {
    const offered = get('Dates offered');
    if (!offered) { SpreadsheetApp.getUi().alert('Type the dates/times you can offer into "Dates offered" first — no email sent.'); e.range.setValue('Requested'); return; }
    MailApp.sendEmail({
      to: email, name: FROM_NAME, replyTo: REPLY_TO,
      subject: 'Pick a date — ' + title,
      htmlBody: wrap(
        '<p>Hi ' + esc(first(get('Name'))) + ',</p>' +
        '<p>Good news — the venue can host you for <b>' + esc(title) + '</b>' + (get('Service') ? ' (' + esc(get('Service')) + ')' : '') + '. Here\'s what\'s available:</p>' +
        '<p>' + esc(offered).replace(/\n/g, '<br>') + '</p>' +
        '<p>Just reply to this email with the one that works for you and your plus one, and we\'ll confirm it. Nothing is booked until you get that confirmation.</p>' +
        '<p>Speak soon,<br>The Wonder Agency</p>'
      )
    });
  }

  if (status === 'Declined') {
    MailApp.sendEmail({
      to: email, name: FROM_NAME, replyTo: REPLY_TO,
      subject: 'About your ' + title + ' request',
      htmlBody: wrap(
        '<p>Hi ' + esc(first(get('Name'))) + ',</p>' +
        '<p>Thanks for requesting <b>' + esc(title) + '</b>.</p>' +
        '<p>Unfortunately, we can\'t fit this one in this time. Places are limited and we have to keep numbers tight for each venue.</p>' +
        '<p>We\'d still love to have you at something else, so keep an eye on Wonder Collabs for new invitations.</p>' +
        '<p>The Wonder Agency</p>'
      )
    });
  }
}

/* helpers */
function first(n) { return (n || '').trim().split(' ')[0] || 'there'; }
function esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function wrap(inner) {
  return '<div style="background:#0a0a0a;padding:40px 20px;font-family:Helvetica,Arial,sans-serif;color:#f1ede4;font-size:15px;line-height:1.6">' +
    '<div style="max-width:560px;margin:0 auto">' +
    '<div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#b69a5b;margin-bottom:28px">The Wonder Agency</div>' +
    inner.replace(/<p>/g, '<p style="margin:0 0 16px;color:#f1ede4">').replace(/<b>/g, '<b style="font-weight:600;color:#ffffff">') +
    '<div style="border-top:1px solid #2a2823;margin-top:32px;padding-top:16px;font-size:12px;color:#7f7a70">Sent by The Wonder Agency on behalf of our clients · ' + REPLY_TO + '</div>' +
    '</div></div>';
}
