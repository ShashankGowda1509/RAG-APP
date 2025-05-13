document.addEventListener('DOMContentLoaded', function() {
    const quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'code-block'],
                ['clean']
            ]
        },
        placeholder: 'Start writing your note here...'
    });

    const noteTitleInput = document.getElementById('note-title');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const newNoteBtn = document.getElementById('new-note-btn');
    const notesList = document.getElementById('notes-list');

    let currentNoteId = null;

    if (saveNoteBtn) saveNoteBtn.addEventListener('click', saveNote);
    if (newNoteBtn) newNoteBtn.addEventListener('click', createNewNote);

    document.querySelectorAll('.note-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (!e.target.closest('.delete-note-btn')) {
                const noteId = this.getAttribute('data-id');
                loadNote(noteId);
                e.preventDefault();
            }
        });
    });

    document.querySelectorAll('.delete-note-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const noteId = this.getAttribute('data-id');
            deleteNote(noteId);
            e.stopPropagation();
        });
    });

    function createNewNote() {
        quill.setContents([]);
        noteTitleInput.value = 'Untitled Note';
        currentNoteId = null;

        const noteData = {
            title: noteTitleInput.value,
            content_delta: JSON.stringify(quill.getContents()),
            content_html: quill.root.innerHTML
        };

        fetch('/create_note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentNoteId = data.note_id;
                showNotification('New note created', 'success');
                addNoteToList(data.note_id, noteTitleInput.value, new Date().toISOString());
            } else {
                showNotification(`Error creating note: ${data.error || 'Unknown error'}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error creating note:', error);
            showNotification('Error creating note: ' + error.message, 'error');
        });
    }

    function saveNote() {
        if (!currentNoteId) {
            createNewNote();
            return;
        }

        const noteData = {
            title: noteTitleInput.value,
            content_delta: JSON.stringify(quill.getContents()),
            content_html: quill.root.innerHTML
        };

        fetch(`/update_note/${currentNoteId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Note saved successfully', 'success');

                const noteItem = document.querySelector(`.note-item[data-id="${currentNoteId}"]`);
                if (noteItem) {
                    const titleElement = noteItem.querySelector('h6');
                    if (titleElement) titleElement.textContent = noteTitleInput.value;
                }
            } else {
                showNotification(`Error saving note: ${data.error || 'Unknown error'}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error saving note:', error);
            showNotification('Error saving note: ' + error.message, 'error');
        });
    }

    function loadNote(noteId) {
        fetch(`/note/${noteId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showNotification(`Error loading note: ${data.error}`, 'error');
                return;
            }

            currentNoteId = noteId;
            noteTitleInput.value = data.title || 'Untitled';

            try {
                quill.setContents(JSON.parse(data.content_delta));
            } catch (e) {
                console.warn('Falling back to HTML content.');
                quill.root.innerHTML = data.content_html || '';
            }

            document.querySelectorAll('.note-item').forEach(item => item.classList.remove('active'));
            const selectedNote = document.querySelector(`.note-item[data-id="${noteId}"]`);
            if (selectedNote) selectedNote.classList.add('active');
        })
        .catch(error => {
            console.error('Error loading note:', error);
            showNotification('Error loading note: ' + error.message, 'error');
        });
    }

    function deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) return;

        fetch(`/delete_note/${noteId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const noteItem = document.querySelector(`.note-item[data-id="${noteId}"]`);
                if (noteItem) noteItem.remove();

                if (currentNoteId === noteId) createNewNote();
                showNotification('Note deleted successfully', 'success');
            } else {
                showNotification(`Error deleting note: ${data.error || 'Unknown error'}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting note:', error);
            showNotification('Error deleting note: ' + error.message, 'error');
        });
    }

    function addNoteToList(id, title, date) {
        const formattedDate = new Date(date).toLocaleString();

        const noteItem = document.createElement('a');
        noteItem.className = 'list-group-item list-group-item-action note-item d-flex justify-content-between align-items-center';
        noteItem.href = '#';
        noteItem.setAttribute('data-id', id);

        noteItem.innerHTML = `
            <div>
                <h6 class="mb-1">${title}</h6>
                <small class="text-muted">${formattedDate}</small>
            </div>
            <button class="btn btn-sm btn-outline-danger delete-note-btn" data-id="${id}">
                <i class="fas fa-trash"></i>
            </button>
        `;

        noteItem.addEventListener('click', function(e) {
            if (!e.target.closest('.delete-note-btn')) {
                loadNote(id);
                e.preventDefault();
            }
        });

        noteItem.querySelector('.delete-note-btn').addEventListener('click', function(e) {
            deleteNote(id);
            e.stopPropagation();
        });

        if (notesList) {
            const emptyMsg = notesList.querySelector('.text-center');
            if (emptyMsg) emptyMsg.remove();
            notesList.insertBefore(noteItem, notesList.firstChild);
        }
    }

    // Initialize with a new note if list is empty
    if (notesList && notesList.children.length === 0) {
        createNewNote();
    }

    /**
     * Simple notification function
     */
    function showNotification(message, type) {
        alert(`${type.toUpperCase()}: ${message}`); // Replace with custom notification logic if needed
    }
});
