import React from 'react'

function enrich(options: any) {
    if (typeof options.list === 'undefined') {
        alert('No genes defined.');
        return;
    }

    var description = options.description || "",
        popup = options.popup || false,
        form = document.createElement('form'),
        listField = document.createElement('input'),
        descField = document.createElement('input');

    form.setAttribute('method', 'post');
    form.setAttribute('action', 'https://maayanlab.cloud/Enrichr/enrich');
    if (popup) {
        form.setAttribute('target', '_blank');
    }
    form.setAttribute('enctype', 'multipart/form-data');

    listField.setAttribute('type', 'hidden');
    listField.setAttribute('name', 'list');
    listField.setAttribute('value', options.list);
    form.appendChild(listField);

    descField.setAttribute('type', 'hidden');
    descField.setAttribute('name', 'description');
    descField.setAttribute('value', description);
    form.appendChild(descField);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

export default function EnrichrButton({ genes, description }: { genes?: (string | null)[] | undefined, description?: string | null }) {
    return (
        <button
            className="btn btn-sm btn-outline text-xs"
            type="button"
            onClick={() => {
                enrich({ list: genes?.join('\n') || '', description: description, popup: true })
            }}
            >
            Submit to Enrichr
        </button>

    )
}
