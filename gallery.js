.gallery-page{
  display:flex;
  flex-direction:column;
  gap:22px;
}

.gallery-hero{
  margin-top:0;
  padding-top:20px;
  border-color:rgba(168,85,247,.24);
  background:
    radial-gradient(circle at top right, rgba(168,85,247,.14), transparent 32%),
    radial-gradient(circle at left center, rgba(216,180,254,.08), transparent 26%),
    linear-gradient(180deg, rgba(28,18,44,.98), rgba(12,15,20,.99));
  box-shadow:
    0 0 0 1px rgba(168,85,247,.08),
    0 12px 28px rgba(0,0,0,.20),
    0 0 18px rgba(168,85,247,.10);
}

.gallery-title-row{
  position:relative;
  padding:0 0 12px;
  margin-bottom:6px;
}

.gallery-title-row::after{
  content:"";
  position:absolute;
  left:0;
  right:0;
  bottom:-8px;
  height:3px;
  border-radius:999px;
  background:linear-gradient(90deg, rgba(168,85,247,.95), rgba(216,180,254,.34) 62%, transparent 100%);
}

.gallery-page-title{
  margin:0;
}

.gallery-helper-copy{
  margin:6px 0 0;
  color:#dfe7ef;
  line-height:1.5;
  max-width:76ch;
}

.gallery-shell{
  border-color:rgba(168,85,247,.20);
  background:
    radial-gradient(circle at top right, rgba(168,85,247,.10), transparent 32%),
    radial-gradient(circle at left center, rgba(59,130,246,.06), transparent 24%),
    linear-gradient(180deg, rgba(18,24,32,.98), rgba(12,15,20,.99));
  box-shadow:
    0 0 0 1px rgba(168,85,247,.08),
    0 12px 28px rgba(0,0,0,.22),
    0 0 18px rgba(168,85,247,.08);
}

.gallery-toolbar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
  margin:0 0 18px;
  padding:12px 14px;
  border:1px solid rgba(168,85,247,.18);
  border-radius:14px;
  background:
    linear-gradient(180deg, rgba(168,85,247,.08), rgba(168,85,247,.02)),
    linear-gradient(180deg, rgba(18,24,32,.98), rgba(12,15,20,.99));
}

.gallery-toolbar-copy{
  color:#dfe7ef;
  line-height:1.3;
}

.gallery-count-label{
  color:var(--muted);
  margin-right:6px;
}

.gallery-grid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:18px;
}

.gallery-card{
  position:relative;
  overflow:hidden;
  border:1px solid rgba(255,255,255,.08);
  border-radius:18px;
  background:
    linear-gradient(180deg, rgba(168,85,247,.10), rgba(168,85,247,.02) 20%, rgba(12,15,20,.98) 100%);
  box-shadow:
    0 0 0 1px rgba(168,85,247,.06),
    0 10px 26px rgba(0,0,0,.24);
  transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.gallery-card:hover{
  transform:translateY(-3px);
  border-color:rgba(168,85,247,.32);
  box-shadow:
    0 0 0 1px rgba(168,85,247,.12),
    0 14px 30px rgba(0,0,0,.28),
    0 0 18px rgba(168,85,247,.12);
}

.gallery-poster-button{
  display:block;
  width:100%;
  padding:0;
  margin:0;
  border:none;
  background:none;
  cursor:pointer;
  text-align:left;
}

.gallery-poster-frame{
  aspect-ratio:2 / 3;
  overflow:hidden;
  background:#090b10;
}

.gallery-poster-image{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.gallery-card-meta{
  padding:14px 14px 16px;
}

.gallery-card-title{
  margin:0 0 8px;
  color:#fff;
  font-size:1rem;
  line-height:1.25;
}

.gallery-card-date{
  margin:0;
  color:#cdb7ef;
  font-size:.84rem;
  font-weight:800;
  letter-spacing:.04em;
  text-transform:uppercase;
}

.gallery-empty{
  padding:20px 0 4px;
  color:var(--muted);
}

.gallery-lightbox{
  position:fixed;
  inset:0;
  z-index:12000;
}

.gallery-lightbox[hidden]{
  display:none;
}

.gallery-lightbox-backdrop{
  position:absolute;
  inset:0;
  background:rgba(0,0,0,.78);
  backdrop-filter:blur(4px);
}

.gallery-lightbox-dialog{
  position:relative;
  z-index:2;
  width:min(92vw, 860px);
  margin:4vh auto 0;
  padding:18px;
  border:1px solid rgba(168,85,247,.24);
  border-radius:20px;
  background:
    linear-gradient(180deg, rgba(168,85,247,.10), rgba(168,85,247,.02)),
    linear-gradient(180deg, rgba(18,24,32,.98), rgba(12,15,20,.99));
  box-shadow:
    0 18px 48px rgba(0,0,0,.42),
    0 0 24px rgba(168,85,247,.12);
}

.gallery-lightbox-image{
  width:100%;
  max-height:76vh;
  object-fit:contain;
  border-radius:14px;
  background:#090b10;
}

.gallery-lightbox-meta{
  padding-top:12px;
}

.gallery-lightbox-meta h3{
  margin:0 0 6px;
  color:#fff;
}

.gallery-lightbox-meta p{
  margin:0;
  color:#d8b4fe;
  font-weight:800;
  letter-spacing:.04em;
  text-transform:uppercase;
}

.gallery-lightbox-close{
  position:absolute;
  top:16px;
  right:18px;
  z-index:3;
  width:42px;
  height:42px;
  border:none;
  border-radius:999px;
  cursor:pointer;
  font-size:1.65rem;
  line-height:1;
  color:#fff;
  background:
    linear-gradient(180deg, rgba(168,85,247,.34), rgba(66,24,94,.94));
  box-shadow:
    0 8px 18px rgba(0,0,0,.28),
    0 0 0 1px rgba(168,85,247,.16);
}

@media (max-width:1000px){
  .gallery-grid{
    grid-template-columns:repeat(2, minmax(0,1fr));
  }
}

@media (max-width:640px){
  .gallery-grid{
    grid-template-columns:1fr;
  }

  .gallery-lightbox-dialog{
    width:min(94vw, 860px);
    margin:3vh auto 0;
    padding:14px;
  }
}
