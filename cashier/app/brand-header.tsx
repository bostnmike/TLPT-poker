export default function BrandHeader({reader=false,stale=false}:{reader?:boolean;stale?:boolean}){
 return <header className="brand-header"><a className="brand" href="/" aria-label="TLPT Cash Register home">TLPT Poker League<span>The League. The Players. The Tilt.</span></a><div className="event">{reader?'Receipt reader':'Payment register'}<span>{reader?'Private connection setup':'Friday · Saturday · MTT'}</span></div>{!reader&&<div className={'live '+(stale?'bad':'')} role="status"><i aria-hidden="true"/>{stale?'Connecting':'Live'}</div>}</header>;
}
