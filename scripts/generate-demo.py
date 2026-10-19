"""Generate the original VGMPulse demo as real YM2612 + SN76489 VGM."""
import math,struct,pathlib
cmd=bytearray();samples=0
clock=7670454

def fm(reg,val,port=0):cmd.extend((0x52+port,reg,val))
def psg(val):cmd.extend((0x50,val))
def wait(n):
 global samples
 while n: k=min(n,65535);cmd.extend((0x61,k&255,k>>8));samples+=k;n-=k

def note(ch,midi):
 port=ch//3;c=ch%3
 fm(0x28,c+(4 if port else 0))
 if midi is None:return
 freq=440*2**((midi-69)/12);block=4;fnum=round(freq*144*2**20/clock/2**(block-1))
 while fnum>2047:block+=1;fnum//=2
 fm(0xA4+c,(block<<3)|(fnum>>8),port);fm(0xA0+c,fnum&255,port);fm(0x28,0xf0|c|(4 if port else 0))

fm(0x22,0);fm(0x27,0);fm(0x2b,0)
for ch in range(6):
 p=ch//3;c=ch%3
 for op in (0,4,8,12):
  for base,val in ((0x30,1),(0x40,48 if ch<3 else 56),(0x50,31),(0x60,10),(0x70,4),(0x80,0x57)):
   fm(base+op+c,val,p)
 fm(0xb0+c,7,p);fm(0xb4+c,0xc0,p)
for i in range(4):psg(0x9f|(i<<5))
melody=[72,76,79,83,81,79,76,74,72,76,79,84,83,79,76,71]
roots=[48,45,53,55]
for step in range(128):
 root=roots[(step//8)%4]
 note(0,melody[step%16]);note(1,root+12+(7 if step%2 else 4));note(2,root if step%4<2 else root+7)
 note(3,root+24+[0,7,12,7][step%4]);note(4,root+19 if step%4==0 else None);note(5,root-12 if step%8==0 else None)
 for ch,mid in ((0,root+36),(1,root+28),(2,root+12)):
  period=round(3579545/(32*440*2**((mid-69)/12)))
  psg(0x80|(ch<<5)|(period&15));psg((period>>4)&63);psg(0x90|(ch<<5)|(12 if ch!=2 else 13))
 psg(0xe4);psg(0xf6 if step%4==0 else 0xfb if step%2 else 0xff)
 wait(5512);psg(0xff);wait(5513)
for ch in range(6):note(ch,None)
for ch in range(4):psg(0x9f|(ch<<5))
wait(22050);cmd.append(0x66)
header=bytearray(0x100);header[:4]=b'Vgm '
def put(o,v):struct.pack_into('<I',header,o,v)
put(8,0x171);put(0xc,3579545);put(0x2c,clock);put(0x18,samples);put(0x24,60);put(0x34,0x100-0x34);header[0x28:0x2c]=bytes((9,0,16,0))
fields=['VGMPulse 示例曲','VGMPulse 示例曲','VGMPulse','','Sega Mega Drive / Genesis','','JamXi, JSG-LLC','','2026','JamXi, JSG-LLC','Copyright © 2017–2026 JamXi, JSG-LLC. Original VGMPulse demo. Licensed under GPL-3.0-only.']
tag=('\0'.join(fields)+'\0').encode('utf-16-le');gd3=b'Gd3 '+struct.pack('<II',0x100,len(tag))+tag
put(0x14,len(header)+len(cmd)-0x14);put(4,len(header)+len(cmd)+len(gd3)-4)
pathlib.Path('public/demo.vgm').write_bytes(header+cmd+gd3)
