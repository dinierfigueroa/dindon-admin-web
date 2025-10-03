// src/components/ProductForm.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, TextField, Button, FormControlLabel, Switch,
  FormControl, InputLabel, Select, MenuItem, Checkbox, OutlinedInput,
  Divider, Paper, IconButton, Chip, FormHelperText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

export default function ProductForm({
  isSupermarket = false,
  categories = [],            // Debe venir con subCategoriasText en cada doc
  initialValues,
  onSubmit,
  submitting
}) {
  const [values, setValues] = useState(initialValues);
  const [imageFile, setImageFile] = useState(null);
  const [catError, setCatError] = useState('');

  useEffect(() => { setValues(initialValues); }, [initialValues]);

  const salePriceCalc = useMemo(
    () => num(values.price) + num(values.adicional_para_la_app),
    [values.price, values.adicional_para_la_app]
  );

  // Preview imagen
  const previewUrl = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : (values.Imagen || ''), [imageFile, values.Imagen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let v = type === 'checkbox' ? checked : value;
    if (['price', 'adicional_para_la_app', 'posicion', 'precio_descuento', 'quantity'].includes(name)) v = num(v);

    // Si cambia la categoría (solo super), reseteamos subcategorías a ['Todos']
    if (isSupermarket && name === 'categoriaenTexto') {
      setValues(prev => ({ ...prev, categoriaenTexto: v, subCategoriasText: ['Todos'] }));
      return;
    }

    setValues(prev => ({ ...prev, [name]: v }));
  };

  // -------- Variantes
  const setVariants = (arr) => setValues(prev => ({ ...prev, variantesProducto: arr, tieneVariantes: arr?.length > 0 }));
  const addVariant = () => setVariants([...(values.variantesProducto || []), {
    _id: Math.random(),
    esDefault: (values.variantesProducto || []).length === 0,
    nombreVariante: '',
    precioTienda: 0,
    adicionalApp: 0,
    precioVentaApp: 0,
    disponible: true
  }]);
  const removeVariant = (idx) => {
    const arr = (values.variantesProducto || []).filter((_, i) => i !== idx);
    if (arr.length && !arr.some(v => v.esDefault)) arr[0].esDefault = true;
    setVariants(arr);
  };
  const variantChange = (idx, field, fieldValue, isNumeric = false, isBool = false) => {
    const arr = [...(values.variantesProducto || [])];
    const v = { ...arr[idx] };
    let val = fieldValue;
    if (isNumeric) val = num(val);
    if (isBool) val = !!val;
    v[field] = val;
    if (field === 'precioTienda' || field === 'adicionalApp') {
      v.precioVentaApp = num(v.precioTienda) + num(v.adicionalApp);
    }
    if (field === 'esDefault' && val === true) {
      for (let i = 0; i < arr.length; i++) arr[i] = { ...arr[i], esDefault: i === idx };
    }
    arr[idx] = v;
    setVariants(arr);
  };

  // -------- Extras
  const setExtras = (arr) => setValues(prev => ({ ...prev, gruposDeExtras: arr }));
  const addGroup = () => setExtras([...(values.gruposDeExtras || []), {
    _gid: Math.random(),
    tituloDelGrupo: '',
    tipoDeSeleccion: 'unica',
    items: []
  }]);
  const removeGroup = (gidx) => setExtras((values.gruposDeExtras || []).filter((_, i) => i !== gidx));
  const updateGroupField = (gidx, field, val) => {
    const arr = [...(values.gruposDeExtras || [])];
    arr[gidx] = { ...arr[gidx], [field]: val };
    if (field === 'tituloDelGrupo') {
      arr[gidx].items = (arr[gidx].items || []).map(it => ({ ...it, tituloDelGrupo: val }));
    }
    setExtras(arr);
  };
  const addItemToGroup = (gidx) => {
    const arr = [...(values.gruposDeExtras || [])];
    const g = { ...arr[gidx] };
    g.items = [...(g.items || []), {
      _iid: Math.random(),
      tituloDelGrupo: g.tituloDelGrupo || '',
      nombre: '',
      costo: 0,
      adicionalApp: 0,
      precioVentaApp: 0
    }];
    arr[gidx] = g;
    setExtras(arr);
  };
  const removeItemFromGroup = (gidx, iidx) => {
    const arr = [...(values.gruposDeExtras || [])];
    const g = { ...arr[gidx] };
    g.items = (g.items || []).filter((_, i) => i !== iidx);
    arr[gidx] = g;
    setExtras(arr);
  };
  const changeItem = (gidx, iidx, field, val, numField = false) => {
    const arr = [...(values.gruposDeExtras || [])];
    const g = { ...arr[gidx] };
    const it = { ...(g.items || [])[iidx] };
    it[field] = numField ? num(val) : val;
    if (field === 'costo' || field === 'adicionalApp') {
      it.precioVentaApp = num(it.costo) + num(it.adicionalApp);
    }
    (g.items || [])[iidx] = it;
    arr[gidx] = g;
    setExtras(arr);
  };

  // -------- Subcategorías (solo super)
  const currentCategory = useMemo(
    () => categories.find(c => c.Categoria === (values.categoriaenTexto || '')),
    [categories, values.categoriaenTexto]
  );

  const availableSubcats = useMemo(() => {
    const arr = Array.isArray(currentCategory?.subCategoriasText) ? currentCategory.subCategoriasText : [];
    const norm = Array.from(new Set(arr.filter(Boolean)));
    // Siempre ofrecer "Todos" primero
    return ['Todos', ...norm.filter(s => s !== 'Todos')];
  }, [currentCategory]);

  const handleSubcatsChange = (e) => {
    let selected = e.target.value;
    if (!Array.isArray(selected)) selected = [selected];
    // Asegurar que "Todos" siempre esté
    if (!selected.includes('Todos')) selected = ['Todos', ...selected];
    setValues(prev => ({ ...prev, subCategoriasText: Array.from(new Set(selected)) }));
  };

  const submit = async (e) => {
    e.preventDefault();

    // Validaciones de categorías
    if (!isSupermarket) {
      if (!values.categorias || values.categorias.length === 0) {
        setCatError('Selecciona al menos una categoría.');
        return;
      }
    } else {
      if (!values.categoriaenTexto) {
        setCatError('Selecciona la categoría principal.');
        return;
      }
    }
    setCatError('');

    // Normalización de payload
    let subcats = values.subCategoriasText || [];
    if (isSupermarket && !subcats.includes('Todos')) subcats = ['Todos', ...subcats];

    const payload = {
      ...values,
      sale_price: salePriceCalc,
      categorias: isSupermarket
        ? (values.categoriaenTexto ? [values.categoriaenTexto] : [])
        : (values.categorias || []),
      categoriaenTexto: isSupermarket
        ? (values.categoriaenTexto || '')
        : (values.categorias || []).join(', '),
      subCategoriasText: isSupermarket ? subcats : [],
      variantesProducto: (values.variantesProducto || []).map(({ _id, ...r }) => r),
      gruposDeExtras: (values.gruposDeExtras || []).map(({ _gid, items = [], ...g }) => ({
        ...g,
        items: items.map(({ _iid, ...it }) => it)
      })),
    };

    await onSubmit(payload, imageFile);
  };

  return (
    <Box component="form" onSubmit={submit}>
      <Grid container spacing={2}>
        <Grid item xs={12}><TextField name="name" label="Nombre" value={values.name} onChange={handleChange} fullWidth required /></Grid>
        <Grid item xs={12}><TextField name="description" label="Descripción" value={values.description} onChange={handleChange} fullWidth multiline rows={3} /></Grid>

        <Grid item xs={12} sm={6}><TextField name="price" label="Costo (price)" type="number" value={values.price} onChange={handleChange} fullWidth inputProps={{ step: '0.01' }} /></Grid>
        <Grid item xs={12} sm={6}><TextField name="adicional_para_la_app" label="Adicional para la app" type="number" value={values.adicional_para_la_app} onChange={handleChange} fullWidth inputProps={{ step: '0.01' }} /></Grid>
        <Grid item xs={12}><TextField label="Precio de venta (sale_price)" value={salePriceCalc} fullWidth InputProps={{ readOnly: true }} helperText="Se calcula automáticamente: costo + adicional" /></Grid>

        <Grid item xs={12}><Divider /></Grid>

        <Grid item xs={12} sm={6}><FormControlLabel control={<Switch name="tiene_descuento" checked={!!values.tiene_descuento} onChange={handleChange} />} label="Tiene descuento" /></Grid>
        <Grid item xs={12} sm={6}><TextField name="precio_descuento" label="Precio con descuento" type="number" value={values.precio_descuento} onChange={handleChange} fullWidth inputProps={{ step: '0.01' }} disabled={!values.tiene_descuento} /></Grid>

        {/* CATEGORÍAS / SKU para super */}
        {!isSupermarket ? (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!catError}>
              <InputLabel>Categorías</InputLabel>
              <Select
                multiple
                name="categorias"
                value={values.categorias || []}
                onChange={handleChange}
                input={<OutlinedInput label="Categorías" />}
                renderValue={(selected) => (selected || []).join(', ')}
              >
                {categories.map(cat => (
                  <MenuItem key={cat.firestoreId} value={cat.Categoria}>
                    <Checkbox checked={(values.categorias || []).indexOf(cat.Categoria) > -1} />
                    {cat.Categoria}
                  </MenuItem>
                ))}
              </Select>
              {!!catError && <FormHelperText>{catError}</FormHelperText>}
            </FormControl>
          </Grid>
        ) : (
          <>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!catError}>
                <InputLabel>Categoría</InputLabel>
                <Select
                  name="categoriaenTexto"
                  value={values.categoriaenTexto || ''}
                  label="Categoría"
                  onChange={handleChange}
                >
                  {categories.map(cat => (
                    <MenuItem key={cat.firestoreId} value={cat.Categoria}>{cat.Categoria}</MenuItem>
                  ))}
                </Select>
                {!!catError && <FormHelperText>{catError}</FormHelperText>}
              </FormControl>
            </Grid>
            {/* SKU (solo super) */}
            <Grid item xs={12} sm={6}>
              <TextField
                name="sku"
                label="SKU (opcional)"
                value={values.sku || ''}
                onChange={handleChange}
                fullWidth
                helperText="Código interno / búsqueda rápida"
              />
            </Grid>

            {/* Subcategorías (solo super) */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Subcategorías</InputLabel>
                <Select
                  multiple
                  value={values.subCategoriasText || ['Todos']}
                  onChange={handleSubcatsChange}
                  input={<OutlinedInput label="Subcategorías" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected || []).map((val) =>
                        <Chip key={val} label={val} />
                      )}
                    </Box>
                  )}
                >
                  {availableSubcats.map(sc => (
                    <MenuItem key={sc} value={sc}>
                      <Checkbox checked={(values.subCategoriasText || []).indexOf(sc) > -1} />
                      {sc}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>“Todos” está siempre seleccionado por defecto.</FormHelperText>
              </FormControl>
            </Grid>
          </>
        )}

        <Grid item xs={12} sm={6}><TextField name="posicion" label="Posición" type="number" value={values.posicion} onChange={handleChange} fullWidth /></Grid>

        {/* Imagen */}
        <Grid item xs={12} sm={6}>
          {previewUrl && (
            <Box sx={{ mb: 1 }}>
              <img src={previewUrl} alt="Imagen del producto" style={{ maxHeight: 120, borderRadius: 6 }} />
            </Box>
          )}
          <Button variant="outlined" component="label">
            {imageFile ? `Imagen: ${imageFile.name}` : (values.Imagen ? 'Cambiar imagen' : 'Subir imagen')}
            <input type="file" hidden onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </Button>
        </Grid>

        <Grid item xs={12} sm={3}><FormControlLabel control={<Switch name="disponible" checked={!!values.disponible} onChange={handleChange} />} label="Disponible" /></Grid>
        <Grid item xs={12} sm={3}><FormControlLabel control={<Switch name="producto_destacado" checked={!!values.producto_destacado} onChange={handleChange} />} label="Producto destacado" /></Grid>

        {/* VARIANTES */}
        <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>Variantes</strong>
            <Button startIcon={<AddIcon />} onClick={addVariant}>AÑADIR VARIANTE</Button>
          </Box>
        </Grid>
        <Grid item xs={12}>
          {(values.variantesProducto || []).map((v, i) => (
            <Paper key={v._id} sx={{ p: 2, mb: 1, border: v.esDefault ? '2px solid' : '1px solid', borderColor: v.esDefault ? 'primary.main' : 'divider' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}><TextField label="Nombre variante" value={v.nombreVariante} onChange={(e) => variantChange(i, 'nombreVariante', e.target.value)} fullWidth size="small" /></Grid>
                <Grid item xs={6} sm={2}><TextField label="Costo" type="number" value={v.precioTienda} onChange={(e) => variantChange(i, 'precioTienda', e.target.value, true)} fullWidth size="small" /></Grid>
                <Grid item xs={6} sm={2}><TextField label="Adicional" type="number" value={v.adicionalApp} onChange={(e) => variantChange(i, 'adicionalApp', e.target.value, true)} fullWidth size="small" /></Grid>
                <Grid item xs={12} sm={2}><TextField label="Precio venta" type="number" value={num(v.precioTienda) + num(v.adicionalApp)} fullWidth size="small" InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={6} sm={1}><FormControlLabel control={<Switch checked={!!v.disponible} onChange={(e) => variantChange(i, 'disponible', e.target.checked, false, true)} />} label="Disp." /></Grid>
                <Grid item xs={6} sm={1}><FormControlLabel control={<Checkbox checked={!!v.esDefault} onChange={(e) => variantChange(i, 'esDefault', e.target.checked, false, true)} />} label="Default" /></Grid>
                <Grid item><IconButton color="error" onClick={() => removeVariant(i)}><DeleteIcon /></IconButton></Grid>
              </Grid>
            </Paper>
          ))}
        </Grid>

        {/* EXTRAS */}
        <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>Grupos de Extras</strong>
            <Button startIcon={<AddIcon />} onClick={addGroup}>AÑADIR GRUPO</Button>
          </Box>
        </Grid>

        <Grid item xs={12}>
          {(values.gruposDeExtras || []).map((g, gi) => (
            <Paper key={g._gid} sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={5}><TextField label="Título del grupo" value={g.tituloDelGrupo} onChange={(e) => updateGroupField(gi, 'tituloDelGrupo', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Tipo de selección</InputLabel>
                    <Select value={g.tipoDeSeleccion || 'unica'} label="Tipo de selección" onChange={(e) => updateGroupField(gi, 'tipoDeSeleccion', e.target.value)}>
                      <MenuItem value="unica">Única</MenuItem>
                      <MenuItem value="multiple">Múltiple</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3} display="flex" justifyContent="flex-end" alignItems="center">
                  <Button startIcon={<AddIcon />} onClick={() => addItemToGroup(gi)}>AGREGAR ÍTEM</Button>
                  <IconButton color="error" onClick={() => removeGroup(gi)}><DeleteIcon /></IconButton>
                </Grid>

                <Grid item xs={12}>
                  {(g.items || []).map((it, ii) => (
                    <Paper key={it._iid} sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}><TextField label="Nombre" value={it.nombre} onChange={(e) => changeItem(gi, ii, 'nombre', e.target.value)} fullWidth size="small" /></Grid>
                        <Grid item xs={6} sm={2}><TextField label="Costo" type="number" value={it.costo} onChange={(e) => changeItem(gi, ii, 'costo', e.target.value, true)} fullWidth size="small" /></Grid>
                        <Grid item xs={6} sm={2}><TextField label="Adicional" type="number" value={it.adicionalApp} onChange={(e) => changeItem(gi, ii, 'adicionalApp', e.target.value, true)} fullWidth size="small" /></Grid>
                        <Grid item xs={12} sm={3}><TextField label="Precio venta" type="number" value={num(it.costo) + num(it.adicionalApp)} fullWidth size="small" InputProps={{ readOnly: true }} /></Grid>
                        <Grid item xs={12} sm={1}><IconButton color="error" onClick={() => removeItemFromGroup(gi, ii)}><DeleteIcon /></IconButton></Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Grid>

        <Grid item xs={12} display="flex" justifyContent="flex-end" gap={1}>
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
        </Grid>
      </Grid>
    </Box>
  );
}