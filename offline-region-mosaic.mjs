// v6.3: pure deterministic regional PMTiles source and cartography planning.
export const REGION_IDS=['hokkaido','tohoku','kanto','chubu','kansai','chugoku','shikoku','kyushu'];
export const sourceId=region=>{
 if(!REGION_IDS.includes(region))throw Error('未知の地方: '+region);
 return 'bike-pmtiles-'+region;
};
export const sourceOptions=record=>{
 const {h,region}=record;sourceId(region);
 const bounds=[h.minLon,h.minLat,h.maxLon,h.maxLat];
 if(bounds.some(v=>!Number.isFinite(v))||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])
  throw Error('地図の範囲が不正: '+region);
 if(h.tileType!==1||!Number.isInteger(h.minZoom)||!Number.isInteger(h.maxZoom)||h.maxZoom<h.minZoom)
  throw Error('PMTilesヘッダーが不正: '+region);
 return {type:'vector',tiles:['bikelocalcolor://'+region+'/{z}/{x}/{y}'],
   bounds,minzoom:h.minZoom,maxzoom:h.maxZoom,
   attribution:'© OpenStreetMap contributors'};
};
export const tileRequest=u=>{
 const m=u.match(/^bikelocalcolor:\/\/([a-z]+)\/(\d+)\/(\d+)\/(\d+)$/);
 if(!m||!REGION_IDS.includes(m[1]))return null;
 return {region:m[1],z:+m[2],x:+m[3],y:+m[4]};
};
export function regionLayers(records,blueprints){
 // Interleave by layer, NOT by region. The other region's land background
 // must never be added on top of a first region's roads or place labels.
 const layers=[];
 for(const layer of blueprints)for(const record of records){
  sourceId(record.region);
  layers.push({id:'bike-base-'+record.region+'-'+layer.name,
    type:layer.type,source:sourceId(record.region),
    'source-layer':layer.src,...layer.extra});
 }
 return layers;
}
