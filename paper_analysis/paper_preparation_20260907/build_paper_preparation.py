#!/usr/bin/env python3
"""Compatibility launcher: numeric preparation + MATLAB .m plotting only."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

HERE=Path(__file__).resolve().parent
MATLAB=HERE/'matlab'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--engine',choices=['auto','matlab','octave'],default='auto')
parser.add_argument('--output',type=Path,default=HERE)
parser.add_argument('--prepare-inputs',action='store_true',help='Rebuild numeric MAT inputs; requires numpy/pandas/scipy')
args=parser.parse_args()
if args.prepare_inputs:
    subprocess.run([sys.executable,str(MATLAB/'prepare_matlab_inputs.py')],check=True)
engine=args.engine
matlab_executable=shutil.which('matlab')
if matlab_executable is None and sys.platform=='darwin':
    installed=sorted(Path('/Applications').glob('MATLAB_R*.app/bin/matlab'),reverse=True)
    installed += sorted((Path.home()/'Applications').glob('MATLAB_R*.app/bin/matlab'),reverse=True)
    if installed: matlab_executable=str(installed[0])
if engine=='auto':
    engine='matlab' if matlab_executable else 'octave'
executable=matlab_executable if engine=='matlab' else shutil.which(engine)
if executable is None:
    raise SystemExit(f'{engine} is unavailable. Open matlab/run_paper_figures.m in MATLAB, or install GNU Octave.')
quote=lambda value: str(value).replace("'","''")
command=f"addpath('{quote(MATLAB)}'); run_paper_figures('{quote(args.output.resolve())}');"
env=os.environ.copy()
if engine=='octave' and sys.platform=='darwin': env['QT_QPA_PLATFORM']='cocoa'
argv=[executable,'-batch',command] if engine=='matlab' else [executable,'--no-gui','--quiet','--eval',command]
subprocess.run(argv,env=env,check=True)
