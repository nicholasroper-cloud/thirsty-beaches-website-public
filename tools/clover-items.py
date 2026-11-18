import json,os,sys,urllib.request
env={}
for l in open(sys.argv[1]):
    l=l.strip()
    if l and not l.startswith('#') and '=' in l:
        k,v=l.split('=',1); env[k.strip()]=v.strip().strip('"').strip("'")
base=env.get('CLOVER_BASE_URL','https://api.clover.com'); m=env.get('CLOVER_MERCHANT_ID') or env.get('MERCHANT_ID'); t=env.get('CLOVER_API_TOKEN') or env.get('CLOVER_ACCESS_TOKEN') or env.get('CLOVER_TOKEN') or env.get('ACCESS_TOKEN')
if not (m and t): print('env keys:',[k for k in env]); sys.exit(1)
items=[];off=0
while True:
    u=f"{base}/v3/merchants/{m}/items?expand=categories&limit=1000&offset={off}"
    r=urllib.request.Request(u,headers={'Authorization':'Bearer '+t})
    d=json.load(urllib.request.urlopen(r,timeout=60)); el=d.get('elements',[]); items+=el
    if len(el)<1000: break
    off+=1000
out=[{'name':i['name'],'price':i.get('price',0)/100,'hidden':i.get('hidden',False),'avail':i.get('available',True),'cats':[c['name'] for c in i.get('categories',{}).get('elements',[])]} for i in items]
json.dump(out,open(sys.argv[2],'w'),indent=1); print(len(out),'items')
