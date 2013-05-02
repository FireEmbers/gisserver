# makefile for fireSim, a sample fire behavior simulator using fireLib
# Collin D. Bevins, October 1996

# The following rules work for UnixWare 2.0.
CC = cc
#CFLAGS = -g -Wall -pedantic -DNDEBUG
CFLAGS = -O2 -Wall -pedantic -DNDEBUG
LIBS = -lm

fireSim: fireSim.o fireLib.o fireLib.h
	$(CC) $(CFLAGS) fireSim.c fireLib.c -o fireSim $(LIBS)

clean:
	-rm *.o

distclean: clean
	rm fireSim

cleandist: distclean


# End of makefile
