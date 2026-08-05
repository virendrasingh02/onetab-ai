// "AI Anywhere" Content Script — Inject floating action pill on web text selection
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';

  let actionBadge = document.getElementById('onetab-ai-anywhere-badge');

  if (selectedText.length > 5) {
    if (!actionBadge) {
      actionBadge = document.createElement('div');
      actionBadge.id = 'onetab-ai-anywhere-badge';
      actionBadge.style.position = 'fixed';
      actionBadge.style.bottom = '24px';
      actionBadge.style.right = '24px';
      actionBadge.style.zIndex = '999999';
      actionBadge.style.backgroundColor = '#0f172a';
      actionBadge.style.border = '1px solid #3b82f6';
      actionBadge.style.borderRadius = '24px';
      actionBadge.style.padding = '8px 16px';
      actionBadge.style.color = '#ffffff';
      actionBadge.style.fontSize = '12px';
      actionBadge.style.fontFamily = 'sans-serif';
      actionBadge.style.cursor = 'pointer';
      actionBadge.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5)';
      actionBadge.innerHTML = '✨ Ask OneTab AI';

      actionBadge.addEventListener('click', () => {
        alert(`Summarizing selected text via OneTab AI:\n\n"${selectedText.substring(0, 100)}..."`);
      });

      document.body.appendChild(actionBadge);
    }
  } else if (actionBadge) {
    actionBadge.remove();
  }
});
