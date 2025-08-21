// Console-only stub to pin the keyboard layout used by Telegram flows.
// No network calls; safe to run without TELEGRAFM token.
const kb = {
  rows: [
    ['Quick note', 'New task'],
    ['New block', 'Plan today'],
    ['Settings']
  ],
  hints: {
    quickNoteTag: '#quick',
    noteFormat: 'Body only; title auto-generated'
  }
};
console.log(JSON.stringify(kb, null, 2));
