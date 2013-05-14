# The following rules work for UnixWare 2.0.
CC = gcc


ifdef DEBUG
FLAGS = -g
endif

ifdef PROFILING
FLAGS = -g
P_FLAG = -pg
endif

ifdef OPTIMIZED
FLAGS = -O3 -funroll-loops
endif

LIBS = -lm

%.o : %.c
	$(CC) $(FLAGS) -c $< $(P_FLAG)


OBJ =	buildFuelProps.o\
			fireLib.o


buildFuelProps: $(OBJ)
	$(CC) -o  $@ $(OBJ) $(LIBS) $(P_FLAG)  

clean:
	@rm -f *.o *.linkinfo *.sw*

cleanDebug:
	@rm -f *.cpp* *cudafe* *hash*  

# End of makefile
