"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import type { Editor } from "@tiptap/react";

interface SyllabusEditorProps {
  content: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  active,
  children,
  onClick,
  title
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      className={`syllabus-toolbar-btn${active ? " syllabus-toolbar-btn-active" : ""}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="syllabus-toolbar-sep" />;
}

function TableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inTable = editor.isActive("table");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function run(cmd: () => boolean) {
    cmd();
    setOpen(false);
  }

  if (!inTable) {
    return (
      <ToolbarButton
        active={false}
        title="Insert table"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        ⊞ Table
      </ToolbarButton>
    );
  }

  return (
    <div className="syllabus-table-menu" ref={ref}>
      <button
        className="syllabus-toolbar-btn syllabus-table-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        Table ▾
      </button>
      {open && (
        <div className="syllabus-table-menu-dropdown" role="menu">
          <div className="syllabus-table-menu-group-label">Columns</div>
          <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addColumnBefore().run())}>
            Add column before
          </button>
          <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addColumnAfter().run())}>
            Add column after
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => run(() => editor.chain().focus().deleteColumn().run())}>
            Delete column
          </button>
          <div className="syllabus-table-menu-divider" />
          <div className="syllabus-table-menu-group-label">Rows</div>
          <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addRowBefore().run())}>
            Add row above
          </button>
          <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addRowAfter().run())}>
            Add row below
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => run(() => editor.chain().focus().deleteRow().run())}>
            Delete row
          </button>
          <div className="syllabus-table-menu-divider" />
          <button type="button" role="menuitem" className="danger" onClick={() => run(() => editor.chain().focus().deleteTable().run())}>
            Delete table
          </button>
        </div>
      )}
    </div>
  );
}

export function SyllabusEditor({ content, onChange }: SyllabusEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "syllabus-prose" }
    }
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="syllabus-editor">
      <div className="syllabus-toolbar">
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <Sep />
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <Sep />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <Sep />
        <ToolbarButton active={editor.isActive("link")} onClick={setLink}>
          Link
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton active={false} onClick={() => editor.chain().focus().unsetLink().run()}>
            Unlink
          </ToolbarButton>
        )}
        <Sep />
        <TableMenu editor={editor} />
      </div>
      <div className="syllabus-editor-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
