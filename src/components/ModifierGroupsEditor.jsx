import React, { useCallback, useEffect, useState } from 'react';
import { db, storage } from '../firebase/config';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Box, Paper, Grid, TextField, Button, IconButton, Typography, Divider,
  Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

export default function ModifierGroupsEditor({ uuidEmpresa, productUuid }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!productUuid) return;
    setLoading(true);
    try {
      // Consulta por productoId (correcto)
      const q1 = query(collection(db, 'modifierGroups'), where('productoId', '==', productUuid));
      const s1 = await getDocs(q1);
      const a1 = s1.docs.map(d => ({ _id: d.id, ...d.data() }));

      // Consulta por productId (legado) para compatibilidad
      const q2 = query(collection(db, 'modifierGroups'), where('productId', '==', productUuid));
      const s2 = await getDocs(q2);
      const a2 = s2.docs.map(d => ({ _id: d.id, ...d.data() }));

      // Unir sin duplicados
      const map = new Map();
      [...a1, ...a2].forEach(g => map.set(g._id, g));
      setGroups([...map.values()]);
    } finally {
      setLoading(false);
    }
  }, [productUuid]);

  useEffect(() => { load(); }, [load]);

  const addGroup = async () => {
    const payload = {
      idModificador: uuidv4(),
      productoId: productUuid,               // ✅ relación correcta
      businessIDText: uuidEmpresa,
      nombre: '',
      tipoSeleccion: 'unica',
      minSeleccion: 0,
      maxSeleccion: 1,
      orden: 0,
      opciones: []
    };
    const refDoc = await addDoc(collection(db, 'modifierGroups'), payload);
    setGroups(prev => [...prev, { _id: refDoc.id, ...payload }]);
  };

  const removeGroup = async (g) => {
    await deleteDoc(doc(db, 'modifierGroups', g._id));
    setGroups(prev => prev.filter(x => x._id !== g._id));
  };

  const setField = (idx, field, val) =>
    setGroups(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: val };
      return arr;
    });

  const addOption = (idx) =>
    setGroups(prev => {
      const arr = [...prev];
      const g = { ...arr[idx] };
      g.opciones = [...(g.opciones || []), {
        opcionID: uuidv4(),
        nombre: '',
        ajustePrecioTienda: 0,
        adicionalApp: 0,
        totalVariation: 0,
        imageUrl: ''
      }];
      arr[idx] = g;
      return arr;
    });

  const removeOption = (gidx, oidx) =>
    setGroups(prev => {
      const arr = [...prev];
      const g = { ...arr[gidx] };
      g.opciones = (g.opciones || []).filter((_, i) => i !== oidx);
      arr[gidx] = g;
      return arr;
    });

  const changeOption = (gidx, oidx, field, val, numeric = false) =>
    setGroups(prev => {
      const arr = [...prev];
      const g = { ...arr[gidx] };
      const op = { ...(g.opciones || [])[oidx] };
      op[field] = numeric ? num(val) : val;
      if (field === 'ajustePrecioTienda' || field === 'adicionalApp') {
        op.totalVariation = num(op.ajustePrecioTienda) + num(op.adicionalApp);
      }
      (g.opciones || [])[oidx] = op;
      arr[gidx] = g;
      return arr;
    });

  const uploadOptionImage = async (gidx, oidx, file) => {
    if (!file) return;
    const op = groups[gidx].opciones[oidx];
    const path = `modifier_options/${productUuid}/${op.opcionID}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    changeOption(gidx, oidx, 'imageUrl', url, false);
  };

  const saveGroup = async (g) => {
    const payload = { ...g };
    delete payload._id;
    // ✅ forzar relación correcta si viene vacío o legado
    payload.productoId = productUuid;
    delete payload.productId;
    await updateDoc(doc(db, 'modifierGroups', g._id), payload);
  };

  if (loading) return <Typography>Cargando modificadores...</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Modificadores</Typography>
        <Button startIcon={<AddIcon />} onClick={addGroup}>Añadir modificador</Button>
      </Box>

      {groups.length === 0 && <Typography variant="body2" sx={{ mb: 2 }}>No hay modificadores para este producto.</Typography>}

      {groups.map((g, gi) => (
        <Paper key={g._id} sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField label="Nombre del modificador" value={g.nombre || ''} onChange={(e) => setField(gi, 'nombre', e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Tipo de selección</InputLabel>
                <Select value={g.tipoSeleccion || 'unica'} label="Tipo de selección" onChange={(e) => setField(gi, 'tipoSeleccion', e.target.value)}>
                  <MenuItem value="unica">Única</MenuItem>
                  <MenuItem value="multiple">Múltiple</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={2}><TextField label="Mín" type="number" value={g.minSeleccion ?? 0} onChange={(e) => setField(gi, 'minSeleccion', Number(e.target.value) || 0)} fullWidth /></Grid>
            <Grid item xs={6} sm={2}><TextField label="Máx" type="number" value={g.maxSeleccion ?? 1} onChange={(e) => setField(gi, 'maxSeleccion', Number(e.target.value) || 0)} fullWidth /></Grid>
            <Grid item xs={12} sm={1} display="flex" justifyContent="flex-end">
              <IconButton color="error" onClick={() => removeGroup(g)}><DeleteIcon /></IconButton>
            </Grid>

            <Grid item xs={12}><Divider /></Grid>

            <Grid item xs={12} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Opciones</Typography>
              <Button startIcon={<AddIcon />} onClick={() => addOption(gi)}>Agregar opción</Button>
            </Grid>

            <Grid item xs={12}>
              {(g.opciones || []).map((op, oi) => (
                <Paper key={op.opcionID} sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}><TextField label="Nombre" value={op.nombre || ''} onChange={(e) => changeOption(gi, oi, 'nombre', e.target.value)} fullWidth size="small" /></Grid>
                    <Grid item xs={6} sm={2}><TextField label="Ajuste costo" type="number" value={op.ajustePrecioTienda || 0} onChange={(e) => changeOption(gi, oi, 'ajustePrecioTienda', e.target.value, true)} fullWidth size="small" /></Grid>
                    <Grid item xs={6} sm={2}><TextField label="Adicional app" type="number" value={op.adicionalApp || 0} onChange={(e) => changeOption(gi, oi, 'adicionalApp', e.target.value, true)} fullWidth size="small" /></Grid>
                    <Grid item xs={12} sm={2}><TextField label="Total variación" type="number" value={num(op.ajustePrecioTienda) + num(op.adicionalApp)} fullWidth size="small" InputProps={{ readOnly: true }} /></Grid>
                    <Grid item xs={12} sm={2}>
                      <Button component="label" size="small" variant="outlined">
                        {op.imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
                        <input type="file" hidden onChange={(e) => uploadOptionImage(gi, oi, e.target.files?.[0])} />
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={1}><IconButton color="error" onClick={() => removeOption(gi, oi)}><DeleteIcon /></IconButton></Grid>
                  </Grid>
                </Paper>
              ))}
            </Grid>

            <Grid item xs={12} display="flex" justifyContent="flex-end" gap={1}>
              <Button variant="contained" onClick={() => saveGroup(g)}>Guardar modificador</Button>
            </Grid>
          </Grid>
        </Paper>
      ))}
    </Box>
  );
}