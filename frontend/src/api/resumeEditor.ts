// POST the PDF to the backend, which redacts + redraws only the changed
// lines in place (layout-preserving) and returns the edited PDF bytes.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function editPdfInPlace(
    file: Blob,
    name: string,
    original: string,
    edited: string,
): Promise<Blob> {
    const fd = new FormData();
    fd.append("file", new File([file], name, { type: "application/pdf" }), name);
    fd.append("original", original);
    fd.append("edited", edited);
    const res = await fetch(`${BASE_URL}/resume/edit-pdf`, { method: "POST", body: fd });
    if (!res.ok) {
        let msg = `Edit failed (HTTP ${res.status})`;
        try {
            const j = await res.json();
            if (j.detail) msg = String(j.detail);
        } catch { /* non-JSON */ }
        throw new Error(msg);
    }
    return res.blob();
}