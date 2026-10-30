"use client";

export default function ConfirmDeleteButton({children="Hapus",className="table-delete",message="Yakin ingin menghapus data ini?"}:{children?:React.ReactNode;className?:string;message?:string}) {
  return <button type="submit" className={className} onClick={event=>{if(!window.confirm(message))event.preventDefault()}}>{children}</button>;
}
