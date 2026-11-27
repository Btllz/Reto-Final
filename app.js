const express = require('express');
const app = express();
require('dotenv').config();
const path = require('path');
const JWT = require('jsonwebtoken');
const PORT = process.env.PORT || 3000;
const DB = process.env.DB;
const JWT_SECRET = process.env.JWT_SECRET;
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const usuarioSchema = new mongoose.Schema ({
  correo: {type: String, required: true, unique: true},
  password: {type: String, required: true},
  rol: {type: String, enum: ['solicitante', 'admin'], default: 'solicitante'}
});

const Usuario = mongoose.model('usuario', usuarioSchema);

const materialSchema = new mongoose.Schema ({
  nombre: {type: String, required: true},
  lote: {type: String, required: true},
  fechaCad: {type: Date, required: true},
  cantidadDisp: {type:Number, required: true}
});

const Material = mongoose.model('material', materialSchema);

//------------------------------------------------------------------------
async function cifrarPassword(password){
  const saltRounds = 10;
  return await bcryptjs.hash(password, saltRounds);
}

async function datosValidos(passwordEscrita, passwordGuardada){
  return await bcryptjs.compare(passwordEscrita, passwordGuardada);
}

function verificarToken(req, res, next){
  const cabecera = req.headers['authorization'];
  if(!cabecera) return res.status(401).json({error: 'Falta el token'});

  const token = cabecera.split(' ')[1];

  try {
    const datos = JWT.verify(token, JWT_SECRET);
    req.usuario = datos;
    next();
  } catch(e){
    console.log(e.message);
    return res.status(401).json({error: 'Token inválido'});
  }
}

function esAdmin(req, res, next){
  if (req.usuario.rol !== 'admin'){
    return res.status(403).json({error: 'Acción inválida para tus permisos actuales'});
  }
next();
}
//--------------------------------------------------------------------------

app.post('/material/register', async (req, res) => {
  try{
    const {correo, password} = req.body;
    if(!correo || !password) return res.status(400).json({mensaje: 'Debe llenar todos los campos'});

    const existe = await Usuario.findOne({correo});
    if(existe) return res.status(409).json({mensaje: 'El correo electrónico ya está registrado, ingresa uno nuevo'});

    const nuevaPassword = await cifrarPassword(password);

    await Usuario.create({correo: correo, password: nuevaPassword});
    res.status(201).json({mensaje: 'Cuenta creada exitosamente'});
  } catch(e){
    console.log(e);
    res.status(500).json({error: 'Error en el servidor'});
  }
});
//---------------------------------------------------------------------------------------------------
app.post('/material/login', async (req, res) => {
  try{
    const {correo, password} = req.body;
    if(!correo || !password) return res.status(400).json({mensaje: 'Llena todos los campos'});

    const usuario = await Usuario.findOne({ correo });
    if(!usuario) return res.status(401).json({mensaje: 'Correo o contraseña inválidos'});

    const contraseñaCorrecta = await datosValidos(password, usuario.password);
    if (!contraseñaCorrecta) return res.status(401).json({error: 'Correo o contraseña inválidos'});

    const token = JWT.sign({id: usuario._id, rol: usuario.rol}, JWT_SECRET, {expiresIn: '1h'});
    res.status(200).json({token});
  }catch(e){
    console.log(e);
    res.status(500).json({error: 'Error del servidor'});
  }
});

app.post('/material/add', verificarToken, esAdmin, async (req, res) => {
  try {
    const {nombre, lote, fechaCad, cantidadDisp} = req.body;

    if(!nombre || !lote || fechaCad == undefined || cantidadDisp == undefined) {
      return res.status(400).json({mensaje: 'Llena todos los campos'});
    }
    if (cantidadDisp < 0) return res.status(400).json({mensaje: 'La cantidad no puede ser menor a cero'});

    await Material.create({nombre, lote, fechaCad, cantidadDisp});
    res.status(201).json({mensaje: 'Material agregado correctamente'});
  } catch(e){
    console.log(e);
    res.status(500).json({error: 'Error en el servidor'});
  }
});

app.get('/material/ver', verificarToken, async (req, res) => {
  try{
    const materiales = await Material.find();

    res.status(200).json({
      mensaje: 'Lista de materiales obtenida con éxito',
      total: materiales.length,
      materiales
    });
  }catch(e){
    console.log(e);
    res.status(500).json({mensaje: 'Error en el servidor'});
  }
});

app.post('/material/salida/:id', verificarToken, async(req, res) => {
  try {
    const materiales = await Material.findOneAndUpdate(
      {_id: req.params.id, cantidadDisp: { $gt: 0} },
      {$inc: {cantidadDisp: -1 } },
      {new: true}
    );

    if(!materiales) return res.status(409).json({error: 'Material agotado o inexistente'});

    res.status(200).json({mensaje: 'Salida exitosa', materiales});
  } catch(e){
    console.log(e);
    res.status(500).json({mensaje: 'Error al registrar la salida'});
  }
});

app.put('/material/:id', verificarToken, esAdmin, async(req, res) => {
  try {
    const {nombre, lote, fechaCad, cantidadDisp} = req.body;
    const matActualizado = await Material.findByIdAndUpdate(
      req.params.id.trim(),
      {nombre, lote, fechaCad, cantidadDisp},
      {new: true, runValidators: true}
    );

    if(!matActualizado) return res.status(404).json({error: 'Material no encontrado'});

    res.status(200).json({mensaje: 'Material actualizado correctamente', material: matActualizado});
  } catch(e){
    console.log(e);
    res.status(500).json({mensaje: 'Error en el servidor'});
  }
});

app.delete('/material/delete/:id', verificarToken, esAdmin, async(req, res) => {
  try{
    const matEliminado = await Material.findByIdAndDelete(req.params.id.trim());

    if(!matEliminado) return res.status(404).json({mensaje: 'No se encontró el material'});

    res.status(200).json({
      mensaje: 'Material eliminado correctamente',
      material: matEliminado
    });
  } catch(e){
    console.log(e);
    res.status(500).json({mensaje: 'Error en el servidor'});
  }
});

if (require.main === module) {
  mongoose.connect(DB)
  .then(() => console.log('conectado a la base de datos'))
  .catch(err => console.log('Error', err.message));
  
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
